import bukovel from "../assets/podorozhi/bukovel.jpg";
import egypt from "../assets/podorozhi/egypt.jpg";
import vilnius from "../assets/podorozhi/vilnius.jpg";
import israel from "../assets/podorozhi/israel.jpg";
import bulgaria from "../assets/podorozhi/bulgaria.jpg";
import chisinau from "../assets/podorozhi/chisinau.jpg";
import dominikana from "../assets/podorozhi/dominikana.jpg";
import bali from "../assets/podorozhi/bali.jpg";
import plitvice from "../assets/podorozhi/plitvice.jpg";
import dubai from "../assets/podorozhi/dubai.jpg";
import zanzibar from "../assets/podorozhi/zanzibar.jpg";
import tayiland from "../assets/podorozhi/tayiland.jpg";
import type { Podorozh } from "../types";

const foto: Record<string, string> = {
  bukovel,
  egypt,
  vilnius,
  israel,
  bulgaria,
  chisinau,
  dominikana,
  bali,
  plitvice,
  dubai,
  zanzibar,
  tayiland,
  rim: "https://images.unsplash.com/photo-1583265627959-fb7042f5133b?w=900&q=80&auto=format&fit=crop",
  vatican:
    "https://images.unsplash.com/photo-1431274172761-fca41d930114?w=900&q=80&auto=format&fit=crop",
  venice:
    "https://images.unsplash.com/photo-1543429776-2782fc8e1acd?w=900&q=80&auto=format&fit=crop",
  pisa: "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?w=900&q=80&auto=format&fit=crop",
  paris:
    "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=900&q=80&auto=format&fit=crop",
  fuji: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=900&q=80&auto=format&fit=crop",
  kiyoto:
    "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=900&q=80&auto=format&fit=crop",
  hory: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=900&q=80&auto=format&fit=crop",
  lis: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&q=80&auto=format&fit=crop",
};

const mista: Record<string, string> = {
  буковель: "bukovel",
  єгипет: "egypt",
  вільнюс: "vilnius",
  ізраїль: "israel",
  болгарія: "bulgaria",
  кишинів: "chisinau",
  кишинев: "chisinau",
  рим: "rim",
  rome: "rim",
  ватикан: "vatican",
  венеція: "venice",
  венеция: "venice",
  venice: "venice",
  піза: "pisa",
  pisa: "pisa",
  париж: "paris",
  paris: "paris",
  токіо: "fuji",
  токио: "fuji",
  tokyo: "fuji",
  кіото: "kiyoto",
  kyoto: "kiyoto",
  карпати: "hory",
  karpaty: "hory",
  "пунта-кана": "dominikana",
  punta_cana: "dominikana",
  домінікана: "dominikana",
  балі: "bali",
  bali: "bali",
  "плітвіцькі озера": "plitvice",
  плитвице: "plitvice",
  дубай: "dubai",
  dubai: "dubai",
  оае: "dubai",
  занзібар: "zanzibar",
  zanzibar: "zanzibar",
  пхукет: "tayiland",
  phuket: "tayiland",
  таїланд: "tayiland",
  "фі-фі": "tayiland",
};

const obkladynkyKrayin: Record<string, string> = {
  IT: "rim",
  FR: "paris",
  UA: "bukovel",
  JP: "fuji",
  EG: "egypt",
  LT: "vilnius",
  IL: "israel",
  BG: "bulgaria",
  MD: "chisinau",
  DO: "dominikana",
  ID: "bali",
  HR: "plitvice",
  AE: "dubai",
  TZ: "zanzibar",
  TH: "tayiland",
};

export function obkladynkaPodorozhi(
  podorozh: Pick<Podorozh, "title" | "country_code">
) {
  const nazva = (podorozh.title || "").trim().toLowerCase();
  const klyuchMista = mista[nazva];
  if (klyuchMista) return foto[klyuchMista];

  const klyuchKrayiny = obkladynkyKrayin[podorozh.country_code];
  if (klyuchKrayiny) return foto[klyuchKrayiny];

  return foto.lis;
}
