
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">Page not found</p>
      <Button 
        onClick={() => navigate('/')}
        className="bg-drift-blue hover:bg-drift-light-blue"
      >
        Return to Dashboard
      </Button>
    </div>
  );
};

export default NotFound;
