import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

type Contact = { username: string | null; name: string | null; profile_pic_url: string | null };

export function ContactAvatar({ contact, className }: { contact: Contact; className?: string }) {
  const label = contact.name ?? contact.username ?? "?";
  return (
    <Avatar className={cn("size-10", className)}>
      {contact.profile_pic_url && <AvatarImage src={contact.profile_pic_url} alt={label} />}
      <AvatarFallback className="bg-gradient-to-br from-fuchsia-100 to-violet-100 text-xs font-semibold text-violet-700">
        {initials(label)}
      </AvatarFallback>
    </Avatar>
  );
}
