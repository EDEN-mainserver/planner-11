const API_BASE = "http://localhost:8000";

export interface Clip {
  title: string;
  start_time: string;
  end_time: string;
  reason: string;
  hook: string;
  virality_score: number;
  category: string;
}

export interface PrepareResponse {
  session_id: string;
  video_path: string;
  srt_path: string | null;
  youtube_title: string | null;
  subtitle_mode: string;
}

export interface AnalyzeResponse {
  session_id: string;
  clips: Clip[];
  total_subtitles: number;
}

export interface GenerateResponse {
  session_id: string;
  generated: number;
  draft_names: string[];
  output_dir: string;
  installed_to_capcut: boolean;
  capcut_paths: string[];
}

export interface SubtitleCheck {
  has_subtitle: boolean;
  source: string | null;
}

export async function checkSubtitle(url: string): Promise<SubtitleCheck> {
  try {
    const res = await fetch(`${API_BASE}/api/check-subtitle?url=${encodeURIComponent(url)}`);
    return res.json();
  } catch {
    return { has_subtitle: false, source: null };
  }
}

export async function startProgress(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/progress/start`, { method: "POST" });
  const data = await res.json();
  return data.progress_id;
}

export async function prepareVideo(
  videoInput: string,
  srtPath: string = "",
  progressId: string = ""
): Promise<PrepareResponse> {
  const form = new FormData();
  form.append("video_input", videoInput);
  form.append("srt_path", srtPath);
  if (progressId) form.append("progress_id", progressId);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/prepare`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.");
  }

  if (!res.ok) {
    let detail = "준비 실패";
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      detail = `서버 오류 (${res.status})`;
    }
    throw new Error(detail);
  }

  const startData = await res.json();
  const pid = startData.progress_id || progressId;

  // 폴링으로 완료 대기
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const p = await getProgress(pid);
        if (p.stage === "done") {
          clearInterval(poll);
          const fullRes = await fetch(`${API_BASE}/api/progress/${pid}`);
          const fullData = await fullRes.json();
          if (fullData.result) {
            resolve(fullData.result as PrepareResponse);
          } else {
            resolve({
              session_id: pid,
              video_path: "",
              srt_path: null,
              youtube_title: null,
              subtitle_mode: "capcut_auto",
            });
          }
        } else if (p.stage === "error") {
          clearInterval(poll);
          reject(new Error(p.message || "준비 중 오류가 발생했습니다."));
        }
      } catch {
        // 폴링 실패는 무시
      }
    }, 1500);
  });
}

export async function analyzeVideo(
  sessionId: string,
  numClips: number = 5,
  customPrompt: string = "",
  clipDuration: number = 60
): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("num_clips", numClips.toString());
  form.append("custom_prompt", customPrompt);
  form.append("clip_duration", clipDuration.toString());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.");
  }

  if (!res.ok) {
    let detail = "분석 실패";
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      detail = `서버 오류 (${res.status})`;
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function generateDrafts(
  sessionId: string,
  selectedIndices: string = "all",
  cropVertical: boolean = false,
  includeSubtitles: boolean = false,
  draftMode: string = "individual",
  installToCapcut: boolean = true,
): Promise<GenerateResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("selected_indices", selectedIndices);
  form.append("crop_vertical", cropVertical.toString());
  form.append("include_subtitles", includeSubtitles.toString());
  form.append("draft_mode", draftMode);
  form.append("install_to_capcut", installToCapcut.toString());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.");
  }

  if (!res.ok) {
    let detail = "생성 실패";
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      detail = `서버 오류 (${res.status})`;
    }
    throw new Error(detail);
  }
  return res.json();
}

export interface ProgressInfo {
  stage: string;
  percent: number;
  message: string;
  result?: PrepareResponse;
}

export async function getProgress(sessionId: string): Promise<ProgressInfo> {
  try {
    const res = await fetch(`${API_BASE}/api/progress/${sessionId}`);
    return res.json();
  } catch {
    return { stage: "idle", percent: 0, message: "" };
  }
}
