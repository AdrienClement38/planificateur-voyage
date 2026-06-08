/**
 * Classification d'une activité par son TITRE (mots-clés) → catégorie + durée.
 * Heuristique COMMUNE aux sources « par titre » (Wikipédia, Wikidata, Wikivoyage) :
 * range « musée … » en Culture, « aiguille … » en Nature, « téléphérique … » en
 * Loisir, etc. Pure (dépend seulement du type `Cat`) → testable isolément, et
 * point unique de vérité pour rester cohérent entre sources.
 */
import type { Cat } from "./core";

export function classifyTitle(title: string): {
  category: Cat;
  duration: string;
} {
  const t = title.toLowerCase();
  if (/spa|thermes|thermal|\bbains\b|bien-[êe]tre|wellness|sauna/.test(t))
    return { category: "Bien-être", duration: "demi-journée" };
  if (
    /t[ée]l[ée](ph[ée]|f[ée])rique|t[ée]l[ée]cabine|funiculaire|cr[ée]maill[èe]re|montenvers|\bgare de\b|petit train|train du|luge|patinoire|parc aquatique|aquarium|\bzoo\b/.test(
      t,
    )
  )
    return { category: "Loisir", duration: "demi-journée" };
  if (/mus[ée]e|galerie|fondation|th[ée][âa]tre|op[ée]ra/.test(t))
    return { category: "Culture", duration: "1h30" };
  if (
    /[ée]glise|temple|cath[ée]drale|basilique|chapelle|abbaye|monast[èe]re/.test(
      t,
    )
  )
    return { category: "Culture", duration: "1h" };
  if (
    /mont|aiguille|\bpic\b|\blac\b|glacier|parc|jardin|cascade|gorges|plage|colline|sommet|\bcol\b|grotte|r[ée]serve|presqu/.test(
      t,
    )
  )
    return { category: "Nature", duration: "demi-journée" };
  if (
    /place|fontaine|\bpont\b|palais|ch[âa]teau|\btour\b|porte|\barc\b|forum|amphith[ée][âa]tre|colis[ée]e|ar[èe]nes|halle|hôtel de ville/.test(
      t,
    )
  )
    return { category: "Culture", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}
