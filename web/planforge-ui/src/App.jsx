import { useState, useEffect, useCallback } from "react";
import { loadProjects, saveProjects } from "./utils/storage";
import { EMPTY_PRD } from "./utils/prd";
import HomePage from "./pages/HomePage";
import InterviewPage from "./pages/InterviewPage";
import EditorPage from "./pages/EditorPage";

export default function App() {
  const [page, setPage]                   = useState('home');
  const [prd, setPrd]                     = useState(EMPTY_PRD);
  const [projectTitle, setProjectTitle]   = useState('');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projects, setProjects]           = useState(() => loadProjects());
  const [aiScore, setAiScore]             = useState(0);

  /* 프로젝트 저장 (신규 or 업데이트) */
  const upsertProject = useCallback((id, title, prdData) => {
    setProjects(prev => {
      const exists = prev.find(p => p.id === id);
      let updated;
      if (exists) {
        updated = prev.map(p =>
          p.id === id ? { ...p, title, prd: prdData, updatedAt: new Date().toISOString() } : p
        );
      } else {
        const newProject = { id, title, prd: prdData, updatedAt: new Date().toISOString() };
        updated = [newProject, ...prev];
      }
      saveProjects(updated);
      return updated;
    });
  }, []);

  /* 프로젝트 삭제 */
  const deleteProject = useCallback((id) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveProjects(updated);
      return updated;
    });
  }, []);

  /* 새 프로젝트 시작 */
  const handleStart = (idea) => {
    const newId = Date.now();
    setCurrentProjectId(newId);
    setProjectTitle(idea);
    setPrd(EMPTY_PRD);
    setAiScore(0);
    setPage('interview');
  };

  /* 인터뷰 완료 → 에디터로 + 저장 */
  const handleInterviewComplete = useCallback(() => {
    upsertProject(currentProjectId, projectTitle, prd);
    setPage('editor');
  }, [currentProjectId, projectTitle, prd, upsertProject]);

  /* 기존 프로젝트 불러오기 */
  const handleLoad = (project) => {
    setCurrentProjectId(project.id);
    setProjectTitle(project.title);
    setPrd(project.prd || EMPTY_PRD);
    setPage('editor');
  };

  /* 에디터에서 홈으로 (자동 저장) */
  const handleHome = useCallback(() => {
    if (currentProjectId) upsertProject(currentProjectId, projectTitle, prd);
    setPage('home');
  }, [currentProjectId, projectTitle, prd, upsertProject]);

  /* PRD 변경 시 자동 저장 (에디터 페이지에서만) */
  useEffect(() => {
    if (page === 'editor' && currentProjectId) {
      const timer = setTimeout(() => upsertProject(currentProjectId, projectTitle, prd), 1500);
      return () => clearTimeout(timer);
    }
  }, [prd, projectTitle, page, currentProjectId, upsertProject]);

  if (page === 'home') return (
    <HomePage
      onStart={handleStart}
      projects={projects}
      onDelete={deleteProject}
      onLoad={handleLoad}
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
      projectTitle={projectTitle}
      setProjectTitle={setProjectTitle}
      onHome={handleHome}
      aiScore={aiScore}
      setAiScore={setAiScore}
    />
  );
}
