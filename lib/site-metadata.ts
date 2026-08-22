// Immagine di anteprima social, in forma esplicita.
// La home la riceve gratis dalla convenzione file `app/opengraph-image.tsx`,
// ma quella convenzione non si applica alle pagine che dichiarano un proprio
// blocco `openGraph`: lì l'immagine va ripetuta a mano, e senza
// width/height/type/alt i crawler mostrano l'anteprima piccola e senza testo
// alternativo. Questa costante tiene allineate `/crea` e `/scopri` alla home.
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "TripTailor — itinerari di viaggio su misura",
} as const;
