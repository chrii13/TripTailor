// Dati presentazionali per la ribbon di bandiere della sezione "Parti dal budget,
// non dalla meta." (components/landing/reverse-search.tsx). Non è logica di prodotto,
// quindi vive qui e non in lib/.

import type { SVGProps } from "react";

type FlagProps = SVGProps<SVGSVGElement>;

function FlagBase({ children, ...props }: FlagProps) {
  return (
    <svg
      viewBox="0 0 30 20"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

// Bande orizzontali uguali, in ordine dall'alto.
function HorizontalBands({
  colors,
  ...props
}: { colors: [string, string, string] } & FlagProps) {
  const h = 20 / 3;
  return (
    <FlagBase {...props}>
      <rect y={0} width={30} height={h} fill={colors[0]} />
      <rect y={h} width={30} height={h} fill={colors[1]} />
      <rect y={2 * h} width={30} height={h} fill={colors[2]} />
    </FlagBase>
  );
}

// Bande verticali uguali, dall'asta al lembo.
function VerticalBands({
  colors,
  ...props
}: { colors: [string, string, string] } & FlagProps) {
  const w = 30 / 3;
  return (
    <FlagBase {...props}>
      <rect x={0} width={w} height={20} fill={colors[0]} />
      <rect x={w} width={w} height={20} fill={colors[1]} />
      <rect x={2 * w} width={w} height={20} fill={colors[2]} />
    </FlagBase>
  );
}

function FlagAustria(props: FlagProps) {
  return <HorizontalBands colors={["#ed2939", "#ffffff", "#ed2939"]} {...props} />;
}

function FlagUngheria(props: FlagProps) {
  return <HorizontalBands colors={["#ce2939", "#ffffff", "#477050"]} {...props} />;
}

function FlagGermania(props: FlagProps) {
  return <HorizontalBands colors={["#000000", "#dd0000", "#ffce00"]} {...props} />;
}

function FlagPaesiBassi(props: FlagProps) {
  return <HorizontalBands colors={["#ae1c28", "#ffffff", "#21468b"]} {...props} />;
}

function FlagFrancia(props: FlagProps) {
  return <VerticalBands colors={["#002395", "#ffffff", "#ed2939"]} {...props} />;
}

function FlagBelgio(props: FlagProps) {
  return <VerticalBands colors={["#000000", "#fae042", "#ed2939"]} {...props} />;
}

function FlagIrlanda(props: FlagProps) {
  return <VerticalBands colors={["#169b62", "#ffffff", "#ff883e"]} {...props} />;
}

function FlagPolonia(props: FlagProps) {
  return (
    <FlagBase {...props}>
      <rect y={0} width={30} height={10} fill="#ffffff" />
      <rect y={10} width={30} height={10} fill="#dc143c" />
    </FlagBase>
  );
}

function FlagCechia(props: FlagProps) {
  return (
    <FlagBase {...props}>
      <rect y={0} width={30} height={10} fill="#ffffff" />
      <rect y={10} width={30} height={10} fill="#d7141a" />
      <polygon points="0,0 0,20 15,10" fill="#11457e" />
    </FlagBase>
  );
}

function FlagPortogallo(props: FlagProps) {
  return (
    <FlagBase {...props}>
      <rect x={0} width={12} height={20} fill="#006600" />
      <rect x={12} width={18} height={20} fill="#ff0000" />
    </FlagBase>
  );
}

function FlagSpagna(props: FlagProps) {
  return (
    <FlagBase {...props}>
      <rect y={0} width={30} height={5} fill="#aa151b" />
      <rect y={5} width={30} height={10} fill="#f1bf00" />
      <rect y={15} width={30} height={5} fill="#aa151b" />
    </FlagBase>
  );
}

function FlagGrecia(props: FlagProps) {
  const stripeH = 20 / 9;
  const stripes = Array.from({ length: 9 }, (_, i) => (
    <rect
      key={i}
      y={i * stripeH}
      width={30}
      height={stripeH}
      fill={i % 2 === 0 ? "#0d5eaf" : "#ffffff"}
    />
  ));
  const cantonW = 12;
  const cantonH = stripeH * 5;
  return (
    <FlagBase {...props}>
      {stripes}
      <rect x={0} y={0} width={cantonW} height={cantonH} fill="#0d5eaf" />
      <rect
        x={0}
        y={cantonH / 2 - cantonH / 10}
        width={cantonW}
        height={cantonH / 5}
        fill="#ffffff"
      />
      <rect
        x={cantonW / 2 - cantonH / 10}
        y={0}
        width={cantonH / 5}
        height={cantonH}
        fill="#ffffff"
      />
    </FlagBase>
  );
}

// Node/Chrome's dati ICU per "it" non aggiungono il punto delle migliaia sotto
// i 5 cifre (minimumGroupingDigits=2), quindi 1150 diventa "1150" invece di
// "1.150" con toLocaleString. I costi qui sono sempre arrotondati alle
// centinaia, quindi basta questo formato manuale.
export function formatCost(cost: number): string {
  if (cost < 1000) return String(cost);
  const thousands = Math.floor(cost / 1000);
  const rest = String(cost % 1000).padStart(3, "0");
  return `${thousands}.${rest}`;
}

export type Destination = {
  id: string;
  city: string;
  cost: number;
  Flag: (props: FlagProps) => React.JSX.Element;
};

export const REVERSE_SEARCH_DESTINATIONS: Destination[] = [
  { id: "vienna", city: "Vienna", cost: 1150, Flag: FlagAustria },
  { id: "budapest", city: "Budapest", cost: 800, Flag: FlagUngheria },
  { id: "berlino", city: "Berlino", cost: 1000, Flag: FlagGermania },
  { id: "amsterdam", city: "Amsterdam", cost: 1400, Flag: FlagPaesiBassi },
  { id: "lione", city: "Lione", cost: 950, Flag: FlagFrancia },
  { id: "bruges", city: "Bruges", cost: 1050, Flag: FlagBelgio },
  { id: "dublino", city: "Dublino", cost: 1250, Flag: FlagIrlanda },
  { id: "cracovia", city: "Cracovia", cost: 700, Flag: FlagPolonia },
  { id: "atene", city: "Atene", cost: 1100, Flag: FlagGrecia },
  { id: "praga", city: "Praga", cost: 850, Flag: FlagCechia },
  { id: "porto", city: "Porto", cost: 1050, Flag: FlagPortogallo },
  { id: "valencia", city: "Valencia", cost: 900, Flag: FlagSpagna },
];
