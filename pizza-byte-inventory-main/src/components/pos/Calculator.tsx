import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator as CalculatorIcon, Delete } from 'lucide-react';

interface CalculatorProps {
  onCalculate?: (result: number) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onCalculate }) => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [resetDisplay, setResetDisplay] = useState(false);

  const handleNumber = (num: string) => {
    if (resetDisplay || display === '0') {
      setDisplay(num);
      setResetDisplay(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOperation = (op: string) => {
    const current = parseFloat(display);
    if (previousValue === null) {
      setPreviousValue(current);
    } else if (operation) {
      const result = calculate(previousValue, current, operation);
      setPreviousValue(result);
      setDisplay(result.toString());
    }
    setOperation(op);
    setResetDisplay(true);
  };

  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+':
        return prev + current;
      case '-':
        return prev - current;
      case '×':
        return prev * current;
      case '÷':
        return current !== 0 ? prev / current : 0;
      default:
        return current;
    }
  };

  const handleEquals = () => {
    if (operation && previousValue !== null) {
      const current = parseFloat(display);
      const result = calculate(previousValue, current, operation);
      setDisplay(result.toString());
      setPreviousValue(null);
      setOperation(null);
      setResetDisplay(true);
      if (onCalculate) {
        onCalculate(result);
      }
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setResetDisplay(false);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const buttons = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalculatorIcon className="h-4 w-4" />
          Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Display */}
        <Input
          type="text"
          value={display}
          readOnly
          className="text-right text-xl font-mono h-12"
        />

        {/* Buttons Grid */}
        <div className="grid grid-cols-4 gap-2">
          {buttons.flat().map((btn, index) => (
            <Button
              key={index}
              variant={['+', '-', '×', '÷', '='].includes(btn) ? 'default' : 'outline'}
              className="h-12 text-lg font-semibold"
              onClick={() => {
                if (btn === '=') {
                  handleEquals();
                } else if (['+', '-', '×', '÷'].includes(btn)) {
                  handleOperation(btn);
                } else if (btn === '.') {
                  handleDecimal();
                } else {
                  handleNumber(btn);
                }
              }}
            >
              {btn}
            </Button>
          ))}
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleClear} className="h-10">
            Clear
          </Button>
          <Button variant="outline" onClick={handleBackspace} className="h-10">
            <Delete className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

