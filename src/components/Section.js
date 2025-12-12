import React from 'react';

const Section = ({
  children,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <section
      className={`py-8 md:py-12 lg:py-16 ${className}`}
      {...props}
    >
      <div className={`section-container ${containerClassName}`}>
        {children}
      </div>
    </section>
  );
};

export default Section;
