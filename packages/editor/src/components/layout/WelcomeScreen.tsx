import React from 'react';
import { useEditorStore } from '@/store/editor-store';

export function WelcomeScreen(): React.ReactElement {
  const { newProject } = useEditorStore();

  const handleNewProject = () => {
    newProject();
  };

  const handleTryDemo = () => {
    const store = useEditorStore.getState();
    store.newProject();
    store.addAct();
    const state = useEditorStore.getState();
    const actId = state.project?.acts[0]?.id;
    if (actId) {
      store.addCase(actId);
      const state2 = useEditorStore.getState();
      const caseId = state2.project?.acts[0]?.cases[0]?.id;
      const sceneId = state2.project?.acts[0]?.cases[0]?.scenes[0]?.id;
      if (caseId && sceneId) {
        store.setSelection({ actId, caseId, sceneId });
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-950 text-amber-100 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-amber-400 mb-2">GIEngine Editor</h1>
        <p className="text-gray-400 text-lg">황금 우상 스타일 추리게임 비주얼 에디터</p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleNewProject}
          className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
        >
          새 프로젝트
        </button>
        <button
          onClick={handleTryDemo}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-amber-200 font-semibold rounded-lg transition-colors border border-amber-800"
        >
          데모 시작
        </button>
      </div>

      <div className="text-gray-600 text-sm text-center max-w-md">
        <p>새 프로젝트를 시작하거나 데모로 에디터 기능을 체험해 보세요.</p>
        <p className="mt-1">완성된 게임은 단일 HTML 파일로 익스포트할 수 있습니다.</p>
      </div>
    </div>
  );
}
