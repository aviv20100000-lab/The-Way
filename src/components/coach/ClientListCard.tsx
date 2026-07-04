import AvatarPhotoPicker from "@/components/AvatarPhotoPicker";

export interface CoachClient {
  id: string;
  name: string;
  email: string;
  has_goals: boolean;
  avatar_url: string | null;
}

interface ClientListCardProps {
  client: CoachClient;
  onOpenData: (client: CoachClient) => void;
  onOpenGoals: (client: CoachClient) => void;
  onOpenWizard: (client: CoachClient) => void;
  onAvatarUploaded: (clientId: string, url: string) => void;
}

export default function ClientListCard({ client, onOpenData, onOpenGoals, onOpenWizard, onAvatarUploaded }: ClientListCardProps) {
  return (
    <div className="rounded-2xl glass-card p-5  transition-all duration-300 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarPhotoPicker
            compact
            name={client.name}
            currentUrl={client.avatar_url}
            targetUserId={client.id}
            onUploaded={(url) => onAvatarUploaded(client.id, url)}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{client.name}</p>
            <p className="truncate text-xs font-normal text-[#8e9379]" dir="ltr">{client.email}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => onOpenData(client)}
            aria-label={`צפה בנתונים של ${client.name}`}
            title={`צפה בנתונים של ${client.name}`}
            className="rounded-lg bg-[#282a2b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#333535] transition-all">
            📊
          </button>
          <button onClick={() => onOpenGoals(client)}
            aria-label={`ערוך יעדים של ${client.name}`}
            title={`ערוך יעדים של ${client.name}`}
            className="rounded-lg bg-[#282a2b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#333535] transition-all">
            🎯
          </button>
        </div>
      </div>
      {!client.has_goals && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#c3f400]/30 bg-[#1b1d1d] p-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">עוד לא הגדרת יעדים ל{client.name}</p>
          <button onClick={() => onOpenWizard(client)} className="rounded-lg bg-[#c3f400] px-4 py-2 text-sm font-bold text-[#161e00] hover:bg-[#d4ff26]">
            הגדר יעדים
          </button>
        </div>
      )}
    </div>
  );
}
