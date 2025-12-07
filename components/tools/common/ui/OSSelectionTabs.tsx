import React from "react";

interface OSSelectionTabsProps {
  operatingSystems: string[];
  activeOS: string;
  setActiveOS: (os: string) => void;
}

const OSSelectionTabs: React.FC<OSSelectionTabsProps> = ({
  operatingSystems,
  activeOS,
  setActiveOS,
}) => {
  return (
    <div className="text-sm font-medium text-center text-gray-500 dark:text-gray-400 ">
      <ul className="flex flex-wrap -mb-px">
        {operatingSystems.map((os) => (
          <li key={os} className="me-2">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveOS(os);
              }}
              className={`inline-block p-4 border-b-2 rounded-t-lg hover:text-gray-600 hover:border-gray-300 ${
                activeOS === os ? "text-blue-600 border-blue-600" : "border-transparent"
              }`}
            >
              {os}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OSSelectionTabs;
