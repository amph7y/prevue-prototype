import { useState, useEffect, useRef } from 'react';

export const useContextMenu = () => {
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const showMenu = (event, items) => {
        event.preventDefault();
        setMenu({ x: event.pageX, y: event.pageY, items });
    };

    const ContextMenuComponent = () =>
        menu && (
            <div
                ref={menuRef}
                className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1"
                style={{ top: menu.y, left: menu.x }}
            >
                {menu.items.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => { item.action(); setMenu(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                        {item.icon} {item.label}
                    </button>
                ))}
            </div>
        );

    return { showMenu, ContextMenuComponent };
};