import {
  THREAD_TEMPLATE_KEY,
  TEMPLATE_OPTIONS_KEY,
  templateSelectionKey,
  CONVERSATION_FORMATS,
  TONE_OPTIONS,
  FLOW_OPTIONS,
  CTA_OPTIONS,
  DEFAULT_TEMPLATE_OPTIONS,
} from "../../eattack/threads/constants";

export function loadThreadTemplate() {
  try { return JSON.parse(localStorage.getItem(THREAD_TEMPLATE_KEY)) || null; }
  catch { return null; }
}

export function loadTemplateOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATE_OPTIONS_KEY)) || {};
    const mergeOptions = (base, custom) => {
      const list = Array.isArray(custom) && custom.length ? custom : [];
      const map = new Map(base.map(option => [option.key, option]));
      list.forEach(option => {
        if (option?.key) map.set(option.key, option);
      });
      return Array.from(map.values());
    };
    return {
      format: mergeOptions(CONVERSATION_FORMATS, saved.format),
      tone: mergeOptions(TONE_OPTIONS, saved.tone),
      flow: mergeOptions(FLOW_OPTIONS, saved.flow),
      cta: mergeOptions(CTA_OPTIONS, saved.cta),
    };
  } catch {
    return DEFAULT_TEMPLATE_OPTIONS;
  }
}

export function saveTemplateOptions(data) {
  localStorage.setItem(TEMPLATE_OPTIONS_KEY, JSON.stringify(data));
}

export function loadTemplateSelection(username) {
  try {
    return JSON.parse(localStorage.getItem(templateSelectionKey(username))) || {};
  } catch {
    return {};
  }
}

export function saveTemplateSelection(username, data) {
  localStorage.setItem(templateSelectionKey(username), JSON.stringify(data));
}

export function resolveSavedSelection(options, selection = {}) {
  const hasOption = (group, key) => options[group]?.some(option => option.key === key);
  return {
    format: hasOption("format", selection.format) ? selection.format : "expert",
    tone: hasOption("tone", selection.tone) ? selection.tone : "template",
    flow: hasOption("flow", selection.flow) ? selection.flow : "template",
    cta: hasOption("cta", selection.cta) ? selection.cta : "template",
  };
}
