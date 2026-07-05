import AvatarPhotoPicker from "@/components/AvatarPhotoPicker";

export interface CoachClient {
  id: string;
  name: string;
  email: string;
  has_goals: boolean;
  avatar_url: string | null;
  in_default_group: boolean;
}

interface ClientListCardProps {
  client: CoachClient;
  onOpenData: (client: CoachClient) => void;
  onOpenGoals: (client: CoachClient) => void;
  onOpenWizard: (client: CoachClient) => void;
  onAvatarUploaded: (clientId: string, url: string) => void;
  onToggleGroup: (client: CoachClient) => void;
}

export default function ClientListCard({ client, onOpenData, onOpenGoals, onOpenWizard, onAvatarUploaded, onToggleGroup }: ClientListCardProps) {
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
      <button
        onClick={() => onToggleGroup(client)}
        aria-label={client.in_default_group ? `הוצא את ${client.name} מקבוצת הצ'אט` : `הוסף את ${client.name} לקבוצת הצ'אט`}
        className={`mt-3 flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
          client.in_default_group
            ? "border-[#c3f400]/30 bg-[#c3f400]/10 text-[#c3f400] hover:bg-[#c3f400]/15"
            : "border-[#444933] bg-[#1e2020] text-[#8e9379] hover:bg-[#282a2b]"
        }`}
      >
        <span>👥 קבוצת הצ'אט</span>
        <span className="text-xs font-bold">{client.in_default_group ? "בקבוצה ✓" : "מחוץ לקבוצה — לחץ להוספה"}</span>
      </button>
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
