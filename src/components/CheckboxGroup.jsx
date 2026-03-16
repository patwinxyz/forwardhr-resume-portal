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
  <div className={`mb-4 rounded-md p-2 ${activeErrorField === category || activeErrorField === otherField ? 'ring-2 ring-red-500 bg-red-50' : ''}`}>
    <label className="block text-gray-700 font-semibold mb-2">{label}</label>
    <div className="flex flex-wrap gap-4">
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            checked={data[category].includes(opt)}
            onChange={() => onCheckboxChange(category, opt)}
            data-field-key={category}
            id={`field-${category}-${String(opt).replace(/\s+/g, '-')}`}
          />
          <span className="ml-2 text-gray-700">{opt}</span>
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
          className={getErrorInputClass(otherField, 'border-b border-gray-400 focus:border-blue-500 outline-none px-2 py-1 text-sm w-32')}
        />
      )}
    </div>
  </div>
);

export default CheckboxGroup;
