// app/match/[id]/page.tsx
import MatchViewer from '@/components/MatchViewer';

export default function MatchPage({ params }: { params: { id: string } }) {
  return <MatchViewer matchId={params.id} />;
}
