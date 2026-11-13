import type { Company } from "@/lib/settings-schema";

/** Только настроенные рабочие каналы. Если каналов нет — честный текст вместо заглушки. */
export function ContactButtons({ company: c, fallback }: { company: Company; fallback: string }) {
  const wa = c.whatsapp.replace(/\D/g, "");
  const tg = c.telegram.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  const tel = c.phone.replace(/[^\d+]/g, "");
  const any = tel || wa || tg || c.email;
  if (!any) return <p className="muted" style={{ margin: 0 }}>{fallback}</p>;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {tel && (
        <a className="btn btn-primary" href={`tel:${tel}`}>
          Позвонить: {c.phone}
        </a>
      )}
      {wa && (
        <a className="btn btn-ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      )}
      {tg && (
        <a className="btn btn-ghost" href={`https://t.me/${encodeURIComponent(tg)}`} target="_blank" rel="noopener noreferrer">
          Telegram
        </a>
      )}
      {c.email && (
        <a className="btn btn-ghost" href={`mailto:${c.email}`}>
          {c.email}
        </a>
      )}
    </div>
  );
}
