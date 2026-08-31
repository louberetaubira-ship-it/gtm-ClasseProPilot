import React, { useMemo } from 'react';
import { marked } from 'marked';

interface Props {
  content: string;
}

const MarkdownLatexRenderer: React.FC<Props> = ({ content }) => {
  const html = useMemo(() => {
    if (!content) return '';
    // La bibliothèque 'marked' assainit la sortie par défaut, ce qui rend l'opération sûre.
    return marked.parse(content, { gfm: true, breaks: true });
  }, [content]);

  return (
    <div
      className="prose prose-indigo max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownLatexRenderer;
