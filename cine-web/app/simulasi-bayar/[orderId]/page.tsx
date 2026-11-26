import { notFound } from "next/navigation";
import SimulasiBayarClient from "@/components/simulasi-bayar-client";
import { findSimulasiPayment } from "@/lib/simulasi-payment";

export const dynamic = "force-dynamic";

export default async function SimulasiBayarPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const details = await findSimulasiPayment(orderId);
  if (!details) notFound();

  return <SimulasiBayarClient initial={details} />;
}
