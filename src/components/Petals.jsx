
import React, { useEffect, useState } from 'react';

const Petals = () => {
    const [petals, setPetals] = useState([]);
    const emojis = ['🌿', '🌱', '🍃', '🌾', '🌻', '🌼', '🌸'];

    useEffect(() => {
        const newPetals = Array.from({ length: 16 }).map((_, i) => ({
            id: i,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            left: Math.random() * 100 + 'vw',
            duration: (5 + Math.random() * 7) + 's',
            delay: (Math.random() * 9) + 's',
            fontSize: (14 + Math.random() * 16) + 'px',
            opacity: 0.4 + Math.random() * 0.4
        }));
        setPetals(newPetals);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {petals.map(p => (
                <div 
                    key={p.id}
                    className="petal"
                    style={{
                        left: p.left,
                        animationDuration: p.duration,
                        animationDelay: p.delay,
                        fontSize: p.fontSize,
                        opacity: p.opacity
                    }}
                >
                    {p.emoji}
                </div>
            ))}
        </div>
    );
};

export default Petals;
