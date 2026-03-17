import React from 'react';

const CheckboxGroup = ({
  label,
  category,
  options,
  otherField,
  data,
  activeErrorField,
  onCheckboxChange,
  onTextChange,
  getErrorInputClass,
}) => (
  <div
    className={`mb-4 rounded-lg p-2 sm:p-3 ${
      activeErrorField === category || activeErrorField === otherField ? 'ring-2 ring-red-500 bg-red-50' : ''
    }`}
  >
    <label className="block text-gray-700 font-semibold mb-2">{label}</label>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
      {options.map((opt) => (
        <label
          key={opt}
          className="inline-flex items-center gap-3 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-blue-300 transition-colors"
        >
          <input
            type="checkbox"
            className="form-checkbox h-5 w-5 shrink-0 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            checked={data[category].includes(opt)}
            onChange={() => onCheckboxChange(category, opt)}
            data-field-key={category}
            id={`field-${category}-${String(opt).replace(/\s+/g, '-')}`}
          />
          <span className="text-gray-700 text-sm sm:text-base">{opt}</span>
        </label>
      ))}
      {otherField && data[category].includes('其他') && (
        <input
          type="text"
          placeholder="請說明"
          name={otherField}
          value={data[otherField]}
          onChange={onTextChange}
          data-field-key={otherField}
          id={`field-${otherField}`}
          className={getErrorInputClass(
            otherField,
            'col-span-1 sm:col-span-2 lg:col-span-3 w-full sm:max-w-xs rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none px-3 py-2 text-base'
          )}
        />
      )}
    </div>
  </div>
);

export default CheckboxGroup;
