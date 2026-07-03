import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface JsonViewerProps {
  data: unknown;
}

export function JsonViewer({ data }: JsonViewerProps) {
  const { addToast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    addToast({
      title: 'Copied',
      description: 'JSON payload copied to clipboard',
      type: 'success',
    });
  };

  if (data === null || data === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-card text-muted-foreground text-sm font-mono">
        null
      </div>
    );
  }

  return (
    <div className="relative h-full bg-[#1e1e1e] group overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 text-white/50 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={handleCopy}
      >
        <Copy className="size-4" />
      </Button>
      <div className="h-full overflow-auto p-4 text-[13px] leading-relaxed text-[#d4d4d4] font-mono">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
