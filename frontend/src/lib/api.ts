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
  srt_path: string;
  youtube_title: string | null;
  whisper_used: boolean;
  video_info: Record<string, unknown>;
}

export interface AnalyzeResponse {
  session_id: string;
  clips: Clip[];
  total_subtitles: number;
  video_info: Record<string, unknown>;
}

export interface GenerateResponse {
  session_id: string;
  generated: number;
  files: string[];
  output_dir: string;
}

export interface SubtitleTemplate {
  name: string;
  fontsize: number;
  fontcolor: string;
  borderw: number;
  bordcolor: string;
  font: string;
  position: string;
  bg: boolean;
  bg_color?: string;
}

export interface TemplatesResponse {
  default: Record<string, SubtitleTemplate>;
  user: Record<string, SubtitleTemplate>;
}

export async function prepareVideo(
  videoInput: string,
  srtPath: string = "",
  whisperModel: string = "base"
): Promise<PrepareResponse> {
  const form = new FormData();
  form.append("video_input", videoInput);
  form.append("srt_path", srtPath);
  form.append("whisper_model", whisperModel);

  const res = await fetch(`${API_BASE}/api/prepare`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "준비 실패");
  }
  return res.json();
}

export async function analyzeVideo(
  sessionId: string,
  numClips: number = 5,
  customPrompt: string = ""
): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("num_clips", numClips.toString());
  form.append("custom_prompt", customPrompt);

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "분석 실패");
  }
  return res.json();
}

export async function generateClips(
  sessionId: string,
  selectedIndices: string = "all",
  cropVertical: boolean = false,
  burnSubtitles: boolean = false,
  subtitleTemplate: string = "basic"
): Promise<GenerateResponse> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("selected_indices", selectedIndices);
  form.append("crop_vertical", cropVertical.toString());
  form.append("burn_subtitles", burnSubtitles.toString());
  form.append("subtitle_template", subtitleTemplate);

  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "생성 실패");
  }
  return res.json();
}

export async function getTemplates(): Promise<TemplatesResponse> {
  const res = await fetch(`${API_BASE}/api/templates`);
  return res.json();
}

export async function saveTemplate(
  name: string,
  template: SubtitleTemplate
): Promise<void> {
  const form = new FormData();
  form.append("name", name);
  form.append("template_data", JSON.stringify(template));

  await fetch(`${API_BASE}/api/templates/save`, {
    method: "POST",
    body: form,
  });
}

export async function deleteTemplate(name: string): Promise<void> {
  await fetch(`${API_BASE}/api/templates/${name}`, { method: "DELETE" });
}

export function getDownloadUrl(sessionId: string, filename: string): string {
  return `${API_BASE}/api/download/${sessionId}/${filename}`;
}
