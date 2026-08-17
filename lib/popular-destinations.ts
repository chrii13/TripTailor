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
};

export const POPULAR_DESTINATIONS: PopularDestination[] = [
  { name: "Roma", country: "Italia", badge: "Città d'arte", icon: "landmark" },
  { name: "Santorini", country: "Grecia", badge: "Mare", icon: "waves" },
  { name: "Kyoto", country: "Giappone", badge: "Cultura", icon: "sparkles" },
  { name: "Dolomiti", country: "Italia", badge: "Montagna", icon: "mountain" },
  { name: "Bali", country: "Indonesia", badge: "Natura", icon: "palmtree" },
  { name: "New York", country: "Stati Uniti", badge: "Metropoli", icon: "building" },
  { name: "Lisbona", country: "Portogallo", badge: "Città sull'oceano", icon: "sun" },
  { name: "Costa Rica", country: "Costa Rica", badge: "Avventura", icon: "treePine" },
];
