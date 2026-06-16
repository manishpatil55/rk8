import { BiosManager } from "@/components/bios/BiosManager";

export const metadata = {
  title: "BIOS Vault // RK8://",
  description:
    "Supply your own console BIOS files. They are verified locally and stored only in your browser — RK8 never bundles, downloads, hosts, or proxies BIOS files.",
};

export default function BiosPage() {
  return <BiosManager />;
}
