import AvatarPhotoPicker from "@/components/AvatarPhotoPicker";

export interface CoachClient {
  id: string;
  name: string;
  email: string;
  /** What the client types at login. Preferred over email for display. */
  username?: string;
  has_goals: boolean;
  avatar_url: string | null;
  in_default_group: boolean;
  /** false = the account is switched off and cannot log in. Data is untouched. */
  active: boolean;
  /** false = no device is registered to this account, so a push has nowhere to go. */
  has_push: boolean;
}

interface ClientListCardProps {
  client: CoachClient;
  onOpenData: (client: CoachClient) => void;
  onOpenGoals: (client: CoachClient) => void;
  onOpenWizard: (client: CoachClient) => void;
  onAvatarUploaded: (clientId: string, url: string) => void;
  onToggleGroup: (client: CoachClient) => void;
  onSendMealReminder: (client: CoachClient) => void;
}

export default function ClientListCard({ client, onOpenData, onOpenGoals, onOpenWizard, onAvatarUploaded, onToggleGroup, onSendMealReminder }: ClientListCardProps) {
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
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-semibold text-white">{client.name}</p>
              {!client.active && (
                <span className="shrink-0 rounded-full border border-red-400/40 bg-red-400/15 px-2 py-0.5 text-[10px] font-bold text-red-200">
                  כבוי
                </span>
              )}
              {!client.has_push && (
                <span
                  title={`${client.name} לא אישר התראות באפליקציה, אז אי אפשר לשלוח לו תזכורת`}
                  className="shrink-0 rounded-full border border-[#444933] bg-[#1e2020] px-2 py-0.5 text-[10px] font-bold text-[#8e9379]"
                >
                  🔕 בלי התראות
                </span>
              )}
            </div>
            {/* Username, not email: accounts are created with a username and the
                stored address is an internal placeholder nobody should see. */}
            <p className="truncate text-xs font-normal text-[#8e9379]" dir="ltr">{client.username ?? client.email}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Left clickable even without a subscription: pressing it is how the
              coach finds out, and the reply says plainly that nothing was sent. */}
          <button onClick={() => onSendMealReminder(client)}
            aria-label={client.has_push
              ? `שלח ל${client.name} תזכורת לצלם את הארוחה`
              : `${client.name} לא אישר התראות — אי אפשר לשלוח לו תזכורת`}
            title={client.has_push
              ? `שלח ל${client.name} תזכורת לצלם את הארוחה`
              : `${client.name} לא אישר התראות — אי אפשר לשלוח לו תזכורת`}
            className={`rounded-lg bg-[#282a2b] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333535] ${client.has_push ? "" : "opacity-40"}`}>
            📸
          </button>
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
