import factions from '../../../../data/factions.json';
import CharactersAdminClient from './CharactersAdminClient';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Characters · Luna Admin',
    robots: { index: false, follow: false },
};

interface FactionLite {
    id: string;
    name: { en: string; ar: string };
}

export default async function CharactersAdminPage() {
    const client = await clientPromise;
    const docs = await client.db('Database').collection('characters').find({}).toArray();
    const initialCharacters = docs.map((d: any) => ({
        _id: d._id?.toString?.() ?? null,
        id: d.id,
        name: d.name ?? { en: '', ar: '' },
        lore: d.lore ?? null,
        faction: d.faction ?? '',
        imageUrl: d.imageUrl ?? '',
        isMainCharacter: !!d.isMainCharacter,
        cardId: d.cardId ?? null,
    }));

    return (
        <CharactersAdminClient
            initialCharacters={initialCharacters}
            factions={factions as FactionLite[]}
        />
    );
}
