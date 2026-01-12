import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-white rounded-2xl shadow-md border border-neutral-200 hover:shadow-xl transition-all duration-300',
      elevated: 'bg-white rounded-2xl shadow-xl border border-neutral-100 hover:shadow-2xl hover:translate-y-[-2px] transition-all duration-300',
      bordered: 'bg-white rounded-2xl shadow-sm border-2 border-neutral-300 hover:border-blue-400 transition-all duration-300',
    };

    return (
      <div
        ref={ref}
        className={`${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;