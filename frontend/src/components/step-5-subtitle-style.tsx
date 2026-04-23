"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  type SubtitleTemplate,
} from "@/lib/api";
import {
  Type, ArrowLeft, ArrowRight, Palette, Save, Trash2, Star,
} from "lucide-react";

interface Props {
  burnSubtitles: boolean;
  subtitleTemplate: string;
  onBurnChange: (v: boolean) => void;
  onTemplateChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const DEFAULT_TEMPLATES: Record<string, SubtitleTemplate> = {
  basic: { name: "기본", fontsize: 24, fontcolor: "white", borderw: 2, bordcolor: "black", font: "Arial", position: "center", bg: false },
  bold_yellow: { name: "굵은 노랑", fontsize: 28, fontcolor: "yellow", borderw: 3, bordcolor: "black", font: "Arial", position: "center", bg: false },
  boxed_white: { name: "박스 흰색", fontsize: 22, fontcolor: "white", borderw: 0, bordcolor: "black", font: "Arial", position: "bottom", bg: true, bg_color: "black@0.6" },
  big_impact: { name: "임팩트", fontsize: 36, fontcolor: "white", borderw: 4, bordcolor: "black", font: "Impact", position: "center", bg: false },
  pastel_pink: { name: "파스텔 핑크", fontsize: 26, fontcolor: "#FFB6C1", borderw: 2, bordcolor: "#333333", font: "Arial", position: "center", bg: false },
  neon_green: { name: "네온 그린", fontsize: 26, fontcolor: "#00FF41", borderw: 3, bordcolor: "black", font: "Arial", position: "center", bg: false },
  minimal: { name: "미니멀", fontsize: 20, fontcolor: "white", borderw: 1, bordcolor: "#555555", font: "Arial", position: "bottom", bg: false },
  news_style: { name: "뉴스 스타일", fontsize: 22, fontcolor: "white", borderw: 0, bordcolor: "black", font: "Arial", position: "bottom", bg: true, bg_color: "#CC0000@0.8" },
};

export function StepSubtitleStyle({
  burnSubtitles,
  subtitleTemplate,
  onBurnChange,
  onTemplateChange,
  onNext,
  onBack,
}: Props) {
  const [userTemplates, setUserTemplates] = useState<Record<string, SubtitleTemplate>>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [editTemplate, setEditTemplate] = useState<SubtitleTemplate>({
    name: "", fontsize: 24, fontcolor: "#ffffff", borderw: 2, bordcolor: "#000000",
    font: "Arial", position: "center", bg: false,
  });

  useEffect(() => {
    getTemplates()
      .then((t) => setUserTemplates(t.user || {}))
      .catch(() => {});
  }, []);

  const allTemplates = { ...DEFAULT_TEMPLATES, ...userTemplates };

  const handleSaveTemplate = async () => {
    if (!saveName) return;
    const template = { ...editTemplate, name: saveName };
    await saveTemplate(saveName, template);
    setUserTemplates((prev) => ({ ...prev, [saveName]: template }));
    setShowSaveDialog(false);
    setSaveName("");
  };

  const handleDeleteTemplate = async (name: string) => {
    await deleteTemplate(name);
    setUserTemplates((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    if (subtitleTemplate === name) onTemplateChange("basic");
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            자막 삽입
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>영상에 자막 번인(burn-in)</Label>
              <p className="text-xs text-muted-foreground">
                자막을 영상에 직접 입혀서 출력합니다
              </p>
            </div>
            <Switch checked={burnSubtitles} onCheckedChange={onBurnChange} />
          </div>
        </CardContent>
      </Card>

      {burnSubtitles && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                자막 스타일 선택
              </CardTitle>
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Palette className="w-4 h-4 mr-1" />
                    커스텀 만들기
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>커스텀 자막 템플릿</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>템플릿 이름</Label>
                      <Input
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="나만의 스타일"
                      />
                    </div>
                    <div>
                      <Label>글자 크기: {editTemplate.fontsize}</Label>
                      <Slider
                        value={[editTemplate.fontsize]}
                        onValueChange={(v) =>
                          setEditTemplate((t) => ({ ...t, fontsize: v[0] }))
                        }
                        min={12}
                        max={48}
                        step={1}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>글자색</Label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={editTemplate.fontcolor}
                            onChange={(e) =>
                              setEditTemplate((t) => ({ ...t, fontcolor: e.target.value }))
                            }
                            className="w-10 h-10 rounded border border-border cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground">{editTemplate.fontcolor}</span>
                        </div>
                      </div>
                      <div>
                        <Label>테두리색</Label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={editTemplate.bordcolor}
                            onChange={(e) =>
                              setEditTemplate((t) => ({ ...t, bordcolor: e.target.value }))
                            }
                            className="w-10 h-10 rounded border border-border cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground">{editTemplate.bordcolor}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>테두리 두께: {editTemplate.borderw}</Label>
                      <Slider
                        value={[editTemplate.borderw]}
                        onValueChange={(v) =>
                          setEditTemplate((t) => ({ ...t, borderw: v[0] }))
                        }
                        min={0}
                        max={6}
                        step={1}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>배경 박스</Label>
                      <Switch
                        checked={editTemplate.bg}
                        onCheckedChange={(v) =>
                          setEditTemplate((t) => ({ ...t, bg: v }))
                        }
                      />
                    </div>
                    {/* 미리보기 */}
                    <div className="p-6 bg-black rounded-lg flex items-center justify-center">
                      <span
                        style={{
                          fontSize: `${Math.min(editTemplate.fontsize, 32)}px`,
                          color: editTemplate.fontcolor,
                          textShadow: `0 0 ${editTemplate.borderw * 2}px ${editTemplate.bordcolor}`,
                          backgroundColor: editTemplate.bg ? "rgba(0,0,0,0.6)" : "transparent",
                          padding: editTemplate.bg ? "4px 12px" : "0",
                          borderRadius: "4px",
                        }}
                      >
                        자막 미리보기
                      </span>
                    </div>
                    <Button onClick={handleSaveTemplate} disabled={!saveName}>
                      <Save className="w-4 h-4 mr-2" />
                      저장
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(allTemplates).map(([key, tmpl]) => {
                const isUser = key in userTemplates;
                return (
                  <button
                    key={key}
                    onClick={() => onTemplateChange(key)}
                    className={`relative p-4 rounded-lg border text-center transition-all ${
                      subtitleTemplate === key
                        ? "border-primary bg-primary/10"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    {isUser && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(key);
                        }}
                        className="absolute top-1 right-1 p-1 rounded hover:bg-destructive/20"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                    {isUser && (
                      <Star className="w-3 h-3 text-yellow-400 absolute top-1 left-1" />
                    )}
                    <div
                      className="text-lg font-bold mb-1"
                      style={{
                        color: tmpl.fontcolor === "white" ? "#fff" : tmpl.fontcolor === "yellow" ? "#fbbf24" : tmpl.fontcolor,
                        textShadow: `0 0 ${tmpl.borderw * 2}px ${tmpl.bordcolor === "black" ? "#000" : tmpl.bordcolor}`,
                      }}
                    >
                      가
                    </div>
                    <div className="text-xs text-muted-foreground">{tmpl.name}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button onClick={onNext} className="flex-1">
          다음: 영상 설정
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
