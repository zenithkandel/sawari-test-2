<?php
// Stop Validator

class StopValidator {
    public static function validate(array $data, bool $isUpdate = false): array {
        $errors = [];

        if (!$isUpdate) {
            if (empty($data['name'])) $errors[] = 'Name is required';
            if (!isset($data['lat'])) $errors[] = 'Latitude is required';
            if (!isset($data['lng'])) $errors[] = 'Longitude is required';
        }

        if (isset($data['lat'])) {
            $lat = floatval($data['lat']);
            if ($lat < -90 || $lat > 90) $errors[] = 'Latitude must be between -90 and 90';
        }
        if (isset($data['lng'])) {
            $lng = floatval($data['lng']);
            if ($lng < -180 || $lng > 180) $errors[] = 'Longitude must be between -180 and 180';
        }

        return $errors;
    }

    public static function defaults(array $data): array {
        $data['icon'] = $data['icon'] ?? 'fa-bus';
        $data['iconType'] = $data['iconType'] ?? 'fontawesome';
        $data['color'] = $data['color'] ?? '#1d4ed8';
        $data['lat'] = floatval($data['lat']);
        $data['lng'] = floatval($data['lng']);
        return $data;
    }
}
