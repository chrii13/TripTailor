export type PopularDestinationIcon =
  | "landmark"
  | "waves"
  | "mountain"
  | "palmtree"
  | "building"
  | "sun"
  | "sparkles"
  | "treePine";

export type PopularDestination = {
  name: string;
  country: string;
  badge: string;
  icon: PopularDestinationIcon;
  /** Valore precompilato nel campo Destinazione del form. */
  query: string;
};

export const POPULAR_DESTINATIONS: PopularDestination[] = [
  { name: "Roma", country: "Italia", badge: "Città d'arte", icon: "landmark", query: "Roma, Italia" },
  { name: "Santorini", country: "Grecia", badge: "Mare", icon: "waves", query: "Santorini, Grecia" },
  { name: "Kyoto", country: "Giappone", badge: "Cultura", icon: "sparkles", query: "Kyoto, Giappone" },
  { name: "Dolomiti", country: "Italia", badge: "Montagna", icon: "mountain", query: "Dolomiti, Italia" },
  { name: "Bali", country: "Indonesia", badge: "Natura", icon: "palmtree", query: "Bali, Indonesia" },
  { name: "New York", country: "Stati Uniti", badge: "Metropoli", icon: "building", query: "New York, Stati Uniti" },
  { name: "Lisbona", country: "Portogallo", badge: "Città sull'oceano", icon: "sun", query: "Lisbona, Portogallo" },
  { name: "Costa Rica", country: "Costa Rica", badge: "Avventura", icon: "treePine", query: "Costa Rica" },
];
