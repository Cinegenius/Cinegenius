import { Film } from "lucide-react";
import { useTranslations } from "next-intl";


export default function Loading() {
  const uiText = useTranslations();

  return (
    <div className="pt-16 min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center animate-pulse">
          <Film size={20} className="text-gold" />
        </div>
        <p className="text-text-muted text-sm">{uiText("Ui.text_9767238939207a")}</p>
      </div>
    </div>
  );
}
