import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

interface ChecklistItemProps {
  text: string;
  checked: boolean;
  onToggle: () => void;
  priority?: 'high' | 'medium' | 'low';
}

export function ChecklistItem({
  text,
  checked,
  onToggle,
  priority,
}: ChecklistItemProps) {
  const priorityColors = {
    high: COLORS.danger,
    medium: COLORS.warning,
    low: COLORS.success,
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
        ]}
      >
        {checked && (
          <Ionicons name="checkmark" size={16} color="#fff" />
        )}
      </View>
      <Text style={[styles.text, checked && styles.textChecked]}>
        {text}
      </Text>
      {priority && (
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: priorityColors[priority] + '20' },
          ]}
        >
          <Text
            style={[styles.priorityText, { color: priorityColors[priority] }]}
          >
            {priority.toUpperCase()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  textChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
