import type { ProjectIndex, Requirement } from './types.js';

const STATUS_EMOJI: Record<Requirement['status'], string> = {
  'done': '✅',
  'in-progress': '🔄',
  'not-started': '⬜',
};

export function formatSummary(index: ProjectIndex): string {
  const total = index.requirements.length;
  const lines: string[] = [];

  lines.push(`# GIEngine PRD 요약`);
  lines.push('');
  lines.push(`**생성일**: ${index.generatedAt.split('T')[0]} | **마지막 커밋**: ${index.lastCommit} | **총 요구사항**: ${total}개`);
  lines.push('');
  lines.push('## 요구사항 목록');
  lines.push('');
  lines.push('| ID | 제목 | 우선순위 | 상태 | 소스 |');
  lines.push('|----|------|----------|------|------|');

  for (const req of index.requirements) {
    const source = req.source.split('/').pop() ?? req.source;
    const statusMark = `${STATUS_EMOJI[req.status]} ${req.status}`;
    lines.push(`| ${req.id} | ${req.title} | ${req.priority} | ${statusMark} | ${source} |`);
  }

  return lines.join('\n');
}

export function formatProgress(index: ProjectIndex): string {
  const reqs = index.requirements;
  const total = reqs.length;
  const done = reqs.filter(r => r.status === 'done').length;
  const inProgress = reqs.filter(r => r.status === 'in-progress').length;
  const notStarted = reqs.filter(r => r.status === 'not-started').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const lines: string[] = [];
  lines.push('# 진행 현황');
  lines.push('');
  lines.push(`## 전체: ${pct}% (${done}/${total} 완료)`);
  lines.push(`- ✅ done: ${done}`);
  lines.push(`- 🔄 in-progress: ${inProgress}`);
  lines.push(`- ⬜ not-started: ${notStarted}`);
  lines.push('');
  lines.push('## 패키지별 현황');
  lines.push('');
  lines.push('| 패키지 | 파일 | 라인 | 테스트 | 최근 수정 |');
  lines.push('|--------|------|------|--------|-----------|');

  for (const [name, pkg] of Object.entries(index.packages)) {
    lines.push(`| ${name} | ${pkg.files} | ${pkg.lines.toLocaleString()} | ${pkg.testFiles} | ${pkg.lastModified} |`);
  }

  lines.push('');
  lines.push('## 최근 git 활동');
  for (const commit of index.gitSummary.recentCommits.slice(0, 5)) {
    lines.push(`- ${commit.hash} ${commit.message}`);
  }

  return lines.join('\n');
}

export function formatRemaining(index: ProjectIndex): string {
  const inProgress = index.requirements.filter(r => r.status === 'in-progress');
  const notStarted = index.requirements.filter(r => r.status === 'not-started');

  if (inProgress.length === 0 && notStarted.length === 0) {
    return '# 남은 작업\n\n남은 작업 없음 🎉';
  }

  const lines: string[] = [];
  lines.push('# 남은 작업');
  lines.push('');

  if (inProgress.length > 0) {
    lines.push(`## 🔄 in-progress (${inProgress.length}개)`);
    lines.push('');
    inProgress.forEach((req, i) => {
      lines.push(`${i + 1}. **${req.id}**: ${req.title}`);
      if (req.evidence.length > 0) {
        for (const ev of req.evidence) lines.push(`   - 근거: ${ev}`);
      }
      lines.push('');
    });
  }

  if (notStarted.length > 0) {
    lines.push(`## ⬜ not-started (${notStarted.length}개)`);
    lines.push('');
    notStarted.forEach((req, i) => {
      lines.push(`${inProgress.length + i + 1}. **${req.id}**: ${req.title}`);
      lines.push(`   - 소스: ${req.source}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}
