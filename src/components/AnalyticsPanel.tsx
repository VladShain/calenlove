import { motion } from "framer-motion";
import { BarChart3, Camera, CalendarRange, Lock, Users } from "lucide-react";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { daysBetween } from "@/lib/date";
import { useAppStore } from "@/store/useAppStore";

export const AnalyticsPanel = () => {
  const { snapshot, session } = useAppStore();
  const isPink = snapshot.settings.theme === "whitePink";
  const theme = snapshot.settings.theme;
  const entries = snapshot.entries.filter((entry) => entry.mode === session.mode);
  const daysTogether = daysBetween(snapshot.settings.relationStartDate);
  const shared = entries.filter((entry) => entry.visibility === "shared").length;
  const privateCount = entries.filter((entry) => entry.visibility === "private").length;
  const photoCount = entries.filter((entry) => Boolean(entry.imageUrl)).length;
  const filledDays = new Set(entries.map((entry) => entry.date)).size;
  const cardStyle = buildPhotoGlassStyle(snapshot.settings.backgroundImage, theme, isPink ? 0.9 : 0.84);

  const cards = [
    {
      icon: CalendarRange,
      title: session.mode === "love" ? "Дней вместе" : "Дней в режиме",
      value: String(daysTogether),
      text: session.mode === "love" ? "Считается с даты начала отношений" : "Считается с даты запуска проекта"
    },
    {
      icon: Users,
      title: "Общие записи",
      value: String(shared),
      text: "Видны сразу обоим пользователям"
    },
    {
      icon: Lock,
      title: "Личные записи",
      value: String(privateCount),
      text: "Остаются только у автора"
    },
    {
      icon: Camera,
      title: "Фото",
      value: String(photoCount),
      text: "Карточки с прикреплёнными изображениями"
    },
    {
      icon: BarChart3,
      title: "Заполненные дни",
      value: String(filledDays),
      text: "Даты, в которых уже есть сохранённые записи"
    }
  ];

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-[32px] border p-5 backdrop-blur-2xl",
          isPink ? "border-white/[0.80] bg-white/[0.44] text-[#3c2537]" : "border-white/[0.10] bg-white/[0.05]"
        )}
        style={cardStyle}
      >
        <div className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className={cn("size-5", isPink ? "text-pink-500" : "text-sky-300")} />
          Аналитика
        </div>
        <div className={cn("text-sm leading-6", isPink ? "text-pink-700/[0.74]" : "text-slate-300/[0.74]")}>
          Компактная статистика по текущему режиму. Здесь видно динамику заполнения, общие и личные записи, а также дни с фото.
        </div>
      </motion.section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <motion.article
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={cn(
              "rounded-[30px] border p-4 backdrop-blur-2xl",
              isPink ? "border-white/[0.80] bg-white/[0.44] text-pink-900" : "border-white/[0.10] bg-white/[0.05]"
            )}
            style={cardStyle}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className={cn("rounded-[20px] p-3", isPink ? "bg-white text-pink-600" : "bg-sky-400/[0.15] text-sky-300")}>
                <card.icon className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">{card.title}</div>
                <div className="text-xs opacity-70">{card.text}</div>
              </div>
            </div>
            <div className="text-3xl font-semibold">{card.value}</div>
          </motion.article>
        ))}
      </div>
    </div>
  );
};
