import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import type { Channel } from "../types";

interface Cfg {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  color: string;
}

const CHANNEL_CFG: Record<Channel, Cfg> = {
  mail: { Icon: Mail, color: "text-blue-500" },
  whatsapp: { Icon: MessageCircle, color: "text-green-500" },
  sms: { Icon: MessageSquare, color: "text-purple-500" },
  call: { Icon: Phone, color: "text-gray-500" },
};

interface ChannelIconProps {
  channel: Channel;
  size?: number;
  className?: string;
}

export default function ChannelIcon({
  channel,
  size = 14,
  className = "",
}: ChannelIconProps) {
  const { Icon, color } = CHANNEL_CFG[channel];

  return <Icon size={size} className={`${color} ${className}`} />;
}
