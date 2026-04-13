import { useState, useEffect, useCallback } from "react";
import { loadProjects, saveProjects, loadTrash, saveTrash } from "./utils/storage";
import { EMPTY_PRD } from "./utils/prd";
import HomePage from "./pages/HomePage";
import InterviewPage from "./pages/InterviewPage";
import EditorPage from "./pages/EditorPage";

export default function App() {
  const [page, setPage]                   = useState('home');
  const [prd, setPrd]                     = useState(EMPTY_PRD);
  const [specData, setSpecData]           = useState(null);
  const [flowData, setFlowData]           = useState(null);
  const [projectTitle, setProjectTitle]   = useState('');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projects, setProjects]           = useState(() => loadProjects());
  const [trash, setTrash]                 = useState(() => loadTrash());
  const [aiScore, setAiScore]             = useState(0);

  /* 프로젝트 저장 (신규 or 업데이트) */
  const upsertProject = useCallback((id, title, prdData, spec, flow) => {
    setProjects(prev => {
      const exists = prev.find(p => p.id === id);
      let updated;
      if (exists) {
        updated = prev.map(p =>
          p.id === id
            ? { ...p, title, prd: prdData, specData: spec, flowData: flow, updatedAt: new Date().toISOString() }
            : p
        );
      } else {
        updated = [{ id, title, prd: prdData, specData: spec, flowData: flow, updatedAt: new Date().toISOString() }, ...prev];
      }
      saveProjects(updated);
      return updated;
    });
  }, []);

  /* 프로젝트 → 휴지통 이동 (소프트 삭제) */
  const deleteProject = useCallback((id) => {
    setProjects(prev => {
      const target = prev.find(p => p.id === id);
      if (target) {
        setTrash(t => {
          const updated = [{ ...target, deletedAt: new Date().toISOString() }, ...t];
          saveTrash(updated);
          return updated;
        });
      }
      const updated = prev.filter(p => p.id !== id);
      saveProjects(updated);
      return updated;
    });
  }, []);

  /* 휴지통 → 복원 */
  const restoreProject = useCallback((id) => {
    setTrash(prev => {
      const target = prev.find(p => p.id === id);
      if (target) {
        const { deletedAt, ...restored } = target;
        setProjects(ps => {
          const updated = [{ ...restored, updatedAt: new Date().toISOString() }, ...ps];
          saveProjects(updated);
          return updated;
        });
      }
      const updated = prev.filter(p => p.id !== id);
      saveTrash(updated);
      return updated;
    });
  }, []);

  /* 휴지통에서 영구 삭제 */
  const permanentDelete = useCallback((id) => {
    setTrash(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveTrash(updated);
      return updated;
    });
  }, []);

  /* 휴지통 비우기 */
  const emptyTrash = useCallback(() => {
    setTrash([]);
    saveTrash([]);
  }, []);

  /* 새 프로젝트 시작 */
  const handleStart = (idea) => {
    const newId = Date.now();
    setCurrentProjectId(newId);
    setProjectTitle(idea);
    setPrd(EMPTY_PRD);
    setSpecData(null);
    setFlowData(null);
    setAiScore(0);
    setPage('interview');
  };

  /* 인터뷰 완료 → 에디터로 + 저장 */
  const handleInterviewComplete = useCallback(() => {
    upsertProject(currentProjectId, projectTitle, prd, specData, flowData);
    setPage('editor');
  }, [currentProjectId, projectTitle, prd, specData, flowData, upsertProject]);

  /* 기존 프로젝트 불러오기 */
  const handleLoad = (project) => {
    setCurrentProjectId(project.id);
    setProjectTitle(project.title);
    setPrd(project.prd || EMPTY_PRD);
    setSpecData(project.specData || null);
    setFlowData(project.flowData || null);
    setAiScore(0);
    setPage('editor');
  };

  /* 에디터에서 홈으로 (자동 저장) */
  const handleHome = useCallback(() => {
    if (currentProjectId) upsertProject(currentProjectId, projectTitle, prd, specData, flowData);
    setPage('home');
  }, [currentProjectId, projectTitle, prd, specData, flowData, upsertProject]);

  /* PRD / specData / flowData 변경 시 자동 저장 (에디터 페이지에서만) */
  useEffect(() => {
    if (page === 'editor' && currentProjectId) {
      const timer = setTimeout(
        () => upsertProject(currentProjectId, projectTitle, prd, specData, flowData),
        1500
      );
      return () => clearTimeout(timer);
    }
  }, [prd, specData, flowData, projectTitle, page, currentProjectId, upsertProject]);

  if (page === 'home') return (
    <HomePage
      onStart={handleStart}
      projects={projects}
      onDelete={deleteProject}
      onLoad={handleLoad}
      trash={trash}
      onRestore={restoreProject}
      onPermanentDelete={permanentDelete}
      onEmptyTrash={emptyTrash}
    />
  );

  if (page === 'interview') return (
    <InterviewPage
      initialIdea={projectTitle}
      prd={prd}
      setPrd={setPrd}
      onComplete={handleInterviewComplete}
      onScoreUpdate={setAiScore}
    />
  );

  return (
    <EditorPage
      prd={prd}
      setPrd={setPrd}
      specData={specData}
      setSpecData={setSpecData}
      flowData={flowData}
      setFlowData={setFlowData}
      projectTitle={projectTitle}
      setProjectTitle={setProjectTitle}
      onHome={handleHome}
      aiScore={aiScore}
      setAiScore={setAiScore}
    />
  );
}
