import React from 'react';
import { Button } from '@/components/ui/button';
import WalletButton from '@/components/WalletButton';
import { ExternalLink } from 'lucide-react';

const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <span className="hidden font-bold sm:inline-block">
              Drift Explorer
            </span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <WalletButton />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            asChild
          >
            <a
              href="https://app.drift.trade/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
