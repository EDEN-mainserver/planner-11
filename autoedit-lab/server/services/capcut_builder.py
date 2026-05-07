"""
pyCapCut 래퍼 서비스
이미지 / 영상 / 자막 / 나레이션 아이템을 받아 캡컷 초안 파일을 생성

핵심 원칙:
  - 모든 시간 값을 정수 마이크로초(μs)로 통일 → float 반올림 오차 원천 차단
  - pyCapCut 은 touching(end == next_start)도 overlap으로 판정 → GAP_US 확보
  - 각 image 아이템은 독립 트랙(video_track_N) 사용 → 아이템 간 충돌 없음
"""
import time
from pathlib import Path
import pycapcut as cc

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

# pyCapCut overlap 판정: new_start <= existing_end → 이 gap 이상 확보
GAP_US = 1_000    # 1ms — pyCapCut overlap 방지 최솟값 (시각적으로 불인지)
MIN_DUR_US = 50_000  # 최소 세그먼트 길이: 50ms


def _s_to_us(seconds: float) -> int:
    """초(float) → 정수 마이크로초"""
    return int(round(seconds * 1_000_000))


def _trange_us(start_us: int, duration_us: int) -> cc.Timerange:
    """정수 마이크로초 → pyCapCut Timerange
    초 단위 문자열로 변환 시 정수 나눗셈을 사용해 float 오차 방지.
    """
    s_start = f"{start_us // 1_000_000}.{start_us % 1_000_000:06d}"
    s_dur   = f"{duration_us // 1_000_000}.{duration_us % 1_000_000:06d}"
    return cc.trange(f"{s_start}s", f"{s_dur}s")


def _try_unlock(draft_dir: str, project_name: str) -> bool:
    """캡컷이 남긴 .locked 파일 제거 시도. 성공하면 True, 실패(파일 점유)하면 False."""
    lock_path = Path(draft_dir) / project_name / ".locked"
    if not lock_path.exists():
        return True
    try:
        lock_path.unlink()
        return True
    except OSError:
        return False  # WinError 32: 캡컷이 파일을 점유 중


def build_draft(
    project_name: str,
    items: list[dict],
    draft_dir: str,
    width:  int  = 1920,
    height: int  = 1080,
    fps:    int  = 30,
    allow_replace: bool = True,
) -> str:
    # 캡컷이 프로젝트를 열어두어 .locked 를 점유 중이면 → 고유 이름으로 우회
    if allow_replace and not _try_unlock(draft_dir, project_name):
        suffix = int(time.time()) % 100_000   # 5자리 타임스탬프
        project_name = f"{project_name}_{suffix}"

    folder = cc.DraftFolder(draft_dir)
    script = folder.create_draft(
        draft_name=project_name,
        width=width,
        height=height,
        fps=fps,
        allow_replace=allow_replace,
    )

    # ── 트랙 생성 ───────────────────────────────────────────────────
    image_items = [i for i in items if i["type"] == "image"]
    for v_idx in range(len(image_items)):
        script.add_track(cc.TrackType.video, track_name=f"video_track_{v_idx}")
    if any(i["type"] == "narration" for i in items):
        script.add_track(cc.TrackType.audio, track_name="audio_track")
    if any(i["type"] == "bgm" for i in items):
        script.add_track(cc.TrackType.audio, track_name="bgm_track")
    if any(i["type"] == "subtitle" for i in items):
        script.add_track(cc.TrackType.text, track_name="text_track")

    # ── 자막 겹침 방지: μs 기반 정수 연산 ──────────────────────────
    sorted_subs = sorted(
        [dict(i) for i in items if i["type"] == "subtitle"],
        key=lambda i: float(i.get("start", 0)),
    )
    for k, sub in enumerate(sorted_subs):
        if k + 1 < len(sorted_subs):
            cur_start_us  = _s_to_us(float(sub.get("start", 0)))
            next_start_us = _s_to_us(float(sorted_subs[k + 1].get("start", 0)))
            if next_start_us <= cur_start_us:
                # 같거나 역전: MIN_DUR_US + GAP_US 만큼 뒤로 밀어야
                # (GAP_US * 2로 밀면 max_dur_us < MIN_DUR_US → 여전히 겹침)
                next_start_us = cur_start_us + MIN_DUR_US + GAP_US
                sorted_subs[k + 1]["start"] = next_start_us / 1_000_000
            # 현재 세그먼트의 최대 허용 duration
            max_dur_us = next_start_us - cur_start_us - GAP_US
            cur_dur_us = _s_to_us(float(sub.get("duration", 3)))
            # max_dur_us < MIN_DUR_US일 경우: 다음 자막 시작도 함께 밀기
            if max_dur_us < MIN_DUR_US:
                max_dur_us = MIN_DUR_US
                next_start_us = cur_start_us + MIN_DUR_US + GAP_US
                sorted_subs[k + 1]["start"] = next_start_us / 1_000_000
            final_dur_us = max(MIN_DUR_US, min(cur_dur_us, max_dur_us))
            sub["_start_us"]    = cur_start_us
            sub["_dur_us"]      = final_dur_us
        else:
            sub["_start_us"] = _s_to_us(float(sub.get("start", 0)))
            sub["_dur_us"]   = max(MIN_DUR_US, _s_to_us(float(sub.get("duration", 3))))

    # non-subtitle 유지 + 정렬된 자막으로 재구성
    non_sub = [i for i in items if i["type"] != "subtitle"]
    items   = non_sub + sorted_subs

    # ── 아이템 순회하며 세그먼트 추가 ──────────────────────────────
    v_idx = 0
    for item in items:
        t = item["type"]

        if t == "image":
            track_name = f"video_track_{v_idx}"
            v_idx += 1
            keep_segs = item.get("silence_cuts")
            if keep_segs:
                _add_video_with_silence_cut(script, item["file_path"], keep_segs, track_name)
            else:
                start_us = _s_to_us(float(item.get("start", 0)))
                dur_us   = _s_to_us(float(item.get("duration", 3)))
                _add_video_or_image(script, item["file_path"], start_us, dur_us, track_name)

        elif t == "subtitle":
            _add_subtitle(
                script,
                item["text"],
                item["_start_us"],
                item["_dur_us"],
                font_size      = float(item.get("font_size",      5.0)),
                color          = tuple(item.get("color",          [1.0, 1.0, 1.0])),
                bold           = bool(item.get("bold",            False)),
                italic         = bool(item.get("italic",          False)),
                underline      = bool(item.get("underline",       False)),
                alpha          = float(item.get("alpha",          1.0)),
                align          = int(item.get("align",            1)),
                letter_spacing = int(item.get("letter_spacing",   0)),
                line_spacing   = int(item.get("line_spacing",     0)),
                transform_x    = float(item.get("transform_x",    0.0)),
                transform_y    = float(item.get("transform_y",    -0.8)),
                font           = item.get("font",                 None),
                border_enabled = bool(item.get("border_enabled",  False)),
                border_color   = tuple(item.get("border_color",   [0.0, 0.0, 0.0])),
                border_width   = float(item.get("border_width",   40.0)),
            )

        elif t == "narration":
            _add_narration(script, item["audio_path"],
                           _s_to_us(float(item.get("start", 0))))

        elif t == "bgm":
            _add_bgm(
                script,
                item["audio_path"],
                _s_to_us(float(item.get("start", 0))),
                volume   = float(item.get("volume",   0.5)),
                fade_in  = float(item.get("fade_in",  0.5)),
                fade_out = float(item.get("fade_out", 0.5)),
            )

    script.save()
    return project_name


# ── 헬퍼 ─────────────────────────────────────────────────────────

def _add_video_or_image(script, file_path: str,
                        start_us: int, duration_us: int,
                        track_name: str = "video_track_0"):
    material = cc.VideoMaterial(file_path)
    ext = Path(file_path).suffix.lower()

    if ext in VIDEO_EXTS:
        actual_us     = material.duration  # pyCapCut 이미 μs 단위 반환
        clip_dur_us   = min(duration_us, actual_us)
        target  = _trange_us(start_us, clip_dur_us)
        source  = _trange_us(0, clip_dur_us)
        segment = cc.VideoSegment(material, target, source_timerange=source)
    else:
        target  = _trange_us(start_us, duration_us)
        segment = cc.VideoSegment(material, target)

    script.add_segment(segment, track_name=track_name)


def _add_video_with_silence_cut(script, file_path: str,
                                keep_segs: list[dict],
                                track_name: str = "video_track_0"):
    """
    비무음 구간을 타임라인에 순서대로 배치.
    정수 μs 연산으로 touching 방지 — 각 세그먼트 사이 GAP_US 확보.
    """
    material        = cc.VideoMaterial(file_path)
    timeline_pos_us = 0  # 타임라인 현재 위치 (μs, 정수)

    for i, seg in enumerate(keep_segs):
        src_start_us = _s_to_us(float(seg["start"]))
        src_dur_us   = max(MIN_DUR_US, _s_to_us(float(seg["duration"])))

        # 마지막 세그먼트 제외: target을 GAP_US 짧게 → 다음 세그먼트와 gap 확보
        is_last      = (i == len(keep_segs) - 1)
        target_dur_us = src_dur_us if is_last else max(MIN_DUR_US, src_dur_us - GAP_US)

        source  = _trange_us(src_start_us, src_dur_us)
        target  = _trange_us(timeline_pos_us, target_dur_us)

        segment = cc.VideoSegment(material, target, source_timerange=source)
        script.add_segment(segment, track_name=track_name)

        # 다음 세그먼트 시작 위치: 이전 target 끝 + GAP_US
        timeline_pos_us += target_dur_us + GAP_US


def _add_subtitle(script, text: str,
                  start_us: int, duration_us: int,
                  font_size:      float = 5.0,
                  color:          tuple = (1.0, 1.0, 1.0),
                  bold:           bool  = False,
                  italic:         bool  = False,
                  underline:      bool  = False,
                  alpha:          float = 1.0,
                  align:          int   = 1,
                  letter_spacing: int   = 0,
                  line_spacing:   int   = 0,
                  transform_x:    float = 0.0,
                  transform_y:    float = -0.8,
                  font:           str   = None,
                  border_enabled: bool  = False,
                  border_color:   tuple = (0.0, 0.0, 0.0),
                  border_width:   float = 40.0):
    style = cc.TextStyle(
        size=font_size, color=tuple(color),
        bold=bold, italic=italic, underline=underline,
        alpha=alpha, align=align,
        letter_spacing=letter_spacing, line_spacing=line_spacing,
    )
    clip = cc.ClipSettings(transform_x=transform_x, transform_y=transform_y)

    # 글꼴 — FontType enum에서 이름으로 조회
    font_obj = None
    if font:
        try:
            font_obj = getattr(cc.FontType, font)
        except AttributeError:
            pass  # 알 수 없는 폰트는 시스템 기본 사용

    # 획(테두리)
    border_obj = None
    if border_enabled:
        border_obj = cc.TextBorder(
            alpha=1.0,
            color=tuple(border_color),
            width=float(border_width),
        )

    segment = cc.TextSegment(
        text, _trange_us(start_us, duration_us),
        font=font_obj, style=style, clip_settings=clip, border=border_obj,
    )
    script.add_segment(segment, track_name="text_track")


def _add_bgm(script, audio_path: str, start_us: int,
             volume: float = 0.5, fade_in: float = 0.5, fade_out: float = 0.5):
    """BGM 오디오 트랙에 추가. 전체 길이 기준으로 페이드인/아웃 적용."""
    material   = cc.AudioMaterial(audio_path)
    dur_us     = material.duration  # 이미 μs
    target     = _trange_us(start_us, dur_us)
    source     = _trange_us(0, dur_us)
    segment    = cc.AudioSegment(material, target, source_timerange=source, volume=volume)
    fade_in_s  = f"{fade_in:.2f}s"
    fade_out_s = f"{fade_out:.2f}s"
    segment.add_fade(fade_in_s, fade_out_s)
    script.add_segment(segment, track_name="bgm_track")


def _add_narration(script, audio_path: str, start_us: int):
    material   = cc.AudioMaterial(audio_path)
    dur_us     = material.duration  # 이미 μs
    target     = _trange_us(start_us, dur_us)
    source     = _trange_us(0, dur_us)
    segment    = cc.AudioSegment(material, target, source_timerange=source, volume=0.8)
    segment.add_fade("0.3s", "0.3s")
    script.add_segment(segment, track_name="audio_track")
