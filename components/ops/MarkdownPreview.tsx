export default function MarkdownPreview({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split("\n").map((line, i) =>
        line.startsWith("#") ? (
          <h3 key={i} className="font-heading font-bold text-lg pt-3">
            {line.replace(/^#+\s*/, "")}
          </h3>
        ) : /^[-*] /.test(line) ? (
          <p key={i} className="pl-4">
            • {line.slice(2)}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {line || " "}
          </p>
        ),
      )}
    </div>
  );
}
