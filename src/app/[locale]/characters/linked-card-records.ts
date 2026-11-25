import type { Card, Character } from '@/types';
import { projectLunaCardArtwork, type ReleaseCardArt } from '@/lib/release-card-art';

export type LinkedCard = { character: Character; card: Card; artwork?: ReleaseCardArt };

export function selectedLinkedCardIndex(entries: readonly LinkedCard[], characterId: string, cardId?: string) {
  const selected = entries.findIndex(entry => entry.character.id === characterId && entry.card.id === cardId);
  return selected >= 0 ? selected : entries.findIndex(entry => entry.character.id === characterId);
}

export function linkedCardsFor(people:readonly Character[],cards:readonly Card[],cinematic:boolean):LinkedCard[] {
  const groups=new Map<string,Card[]>();
  const byId=new Map(cards.map(card=>[card.id,card]));
  for(const card of cards){
    if(!card.characterId) continue;
    const group=groups.get(card.characterId);
    if(group) group.push(card);
    else groups.set(card.characterId,[card]);
  }
  return people.flatMap(character=>{
    const group=groups.get(character.id)??[];
    const declared=character.cardId ? byId.get(character.cardId) : undefined;
    const linked=declared ? [declared,...group.filter(card=>card.id!==declared.id)] : group;
    return linked.map(card=>({character,card,artwork:projectLunaCardArtwork(card,cinematic)}));
  });
}
