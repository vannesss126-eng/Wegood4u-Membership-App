import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface DropdownWithOthersProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

export default function DropdownWithOthers({
  label,
  value,
  options,
  onSelect,
  placeholder = "Enter your custom option"
}: DropdownWithOthersProps) {
  const [showOthersInput, setShowOthersInput] = useState(false);
  const [othersValue, setOthersValue] = useState('');
  
  // Check if current value is in options or if it's a custom "others" value
  const isBudgetOther = label.includes('Budget') && 
                       (value === 'Other (please specify)' || 
                        (value && !options.includes(value) && value !== ''));
  
  // For other fields, check if it's "Others" or a custom value  
  const isOtherOption = !label.includes('Budget') && 
                       (value === 'Others' || 
                        (value && !options.includes(value) && value !== ''));
  
  const shouldShowOthersInput = isBudgetOther || isOtherOption;
  const displayValue = shouldShowOthersInput ? 
                      (label.includes('Budget') ? 'Other (please specify)' : 'Others') : 
                      value;
  
  // Set up others input when component mounts if we have a custom value
  useEffect(() => {
    if (shouldShowOthersInput) {
      setShowOthersInput(true);
      if (value === 'Others' || value === 'Other (please specify)') {
        setOthersValue('');
      } else {
        setOthersValue(value);
      }
    }
  }, [value, shouldShowOthersInput]);
  
  const handleOptionSelect = (option: string) => {
    const isOthersOption = option === 'Others' || option === 'Other (please specify)';
    
    if (isOthersOption) {
      LayoutAnimation.easeInEaseOut();
      setShowOthersInput(true);
      if (!othersValue) {
        setOthersValue('');
        onSelect('');
      } else {
        onSelect(othersValue);
      }
    } else {
      LayoutAnimation.easeInEaseOut();
      setShowOthersInput(false);
      setOthersValue('');
      onSelect(option);
    }
  };
  
  const handleOthersChange = (text: string) => {
    setOthersValue(text);
    onSelect(text);
  };
  
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.dropdownContainer}>
        {options.map((option) => {
          const isSelected = displayValue === option || 
                            (shouldShowOthersInput && (option === 'Others' || option === 'Other (please specify)'));
          
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.dropdownOption,
                isSelected && styles.selectedDropdownOption
              ]}
              onPress={() => handleOptionSelect(option)}
            >
              <Text style={[
                styles.dropdownOptionText,
                isSelected && styles.selectedDropdownOptionText
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
        
        {/* Animated Others Input */}
        {showOthersInput && (
          <View style={styles.othersInputContainer}>
            <Text style={styles.othersInputLabel}>Please specify:</Text>
            <TextInput
              style={styles.othersTextInput}
              placeholder={placeholder}
              value={othersValue}
              onChangeText={handleOthersChange}
              autoFocus={!shouldShowOthersInput || othersValue === ''}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedDropdownOption: {
    backgroundColor: '#f0fdf4',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectedDropdownOptionText: {
    color: '#206E56',
    fontWeight: '600',
  },
  othersInputContainer: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  othersInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 8,
  },
  othersTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
});