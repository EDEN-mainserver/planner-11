import os, json, uuid, subprocess
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTPUTS = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUTPUTS, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=OUTPUTS), name="outputs")

jobs = {}

class ConvertRequest(BaseModel):
    url: str
    length: int = 60
    title_lang: str = "ko"
    subtitle_lang: str = "ko"
    template: str = "dynamic"

def run_pipeline(job_id: str, req: ConvertRequest):
    job = jobs[job_id]
    job_dir = os.path.join(OUTPUTS, job_id)
    os.makedirs(job_dir, exist_ok=True)
    try:
        job.update({"progress": 10, "message": "영상 다운로드 중..."})
        video_path = os.path.join(job_dir, "source.mp4")
        subprocess.run(["yt-dlp", "-f", "mp4", "-o", video_path, "--no-playlist", req.url], check=True, capture_output=True)

        job.update({"progress": 30, "message": "음성 분석 중..."})
        result = subprocess.run(["python3", "-c", f"""
import whisper, json
model = whisper.load_model("base")
r = model.transcribe("{video_path}", language="ko")
print(json.dumps(r["segments"]))
"""], capture_output=True, text=True, check=True)
        segments = json.loads(result.stdout)

        job.update({"progress": 60, "message": "핵심 장면 추출 중..."})
        clips, current, start, texts = [], 0, 0, []
        for seg in segments:
            dur = seg["end"] - seg["start"]
            if current == 0: start = seg["start"]
            current += dur
            texts.append(seg["text"].strip())
            if current >= req.length:
                clips.append({"start": start, "end": seg["end"], "text": " ".join(texts)})
                current, texts = 0, []
                if len(clips) >= 3: break

        job.update({"progress": 80, "message": "쇼츠 편집 중..."})
        results = []
        for i, clip in enumerate(clips):
            out_path = os.path.join(job_dir, f"short_{i+1}.mp4")
            subprocess.run(["ffmpeg", "-y", "-i", video_path,
                "-ss", str(clip["start"]), "-to", str(clip["end"]),
                "-vf", "crop=ih*9/16:ih,scale=1080:1920",
                "-c:v", "libx264", "-c:a", "aac", out_path], check=True, capture_output=True)
            dur = int(clip["end"] - clip["start"])
            results.append({"id": i+1, "title": f"하이라이트 #{i+1}",
                "duration": f"{dur}���",
                "text": clip["text"], "url": f"/outputs/{job_id}/short_{i+1}.mp4"})

        job.update({"status": "done", "progress": 100, "message": "완료", "results": results})
    except Exception as e:
        job.update({"status": "error", "progress": 0, "message": str(e), "results": []})

@app.post("/convert")
def convert(req: ConvertRequest, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "running", "progress": 0, "message": "시작 중...", "results": []}
    bg.add_task(run_pipeline, job_id, req)
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def status(job_id: str):
    return jobs.get(job_id, {"status": "not_found"})
