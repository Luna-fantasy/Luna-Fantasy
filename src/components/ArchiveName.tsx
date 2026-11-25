/** Keep punctuation inside a name, including a printed hard hyphen, on the same line. */
const internalPunctuation = new RegExp('\\S[\\p{P}\\p{S}]\\S', 'u');

export function ArchiveName({ children }: { children: string }) {
  if (!internalPunctuation.test(children)) return children;

  return children.split(/(\s+)/).map((word, index) =>
    internalPunctuation.test(word)
      ? <span key={index} style={{ whiteSpace: 'nowrap' }}>{word}</span>
      : word
  );
}
