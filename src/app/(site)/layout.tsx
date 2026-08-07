/*
 * A casca da vitrine. O tema próprio vive aqui e não vaza para o admin
 * nem para os portais: a vitrine persuade, os portais operam.
 */
export default function LayoutVitrine({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="vitrine min-h-svh">{children}</div>;
}
