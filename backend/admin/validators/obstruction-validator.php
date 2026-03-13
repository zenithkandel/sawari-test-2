<?php
// Obstruction Validator

class ObstructionValidator
{
    public static function validate(array $data, bool $isUpdate = false): array
    {
        $errors = [];

        if (!$isUpdate) {
            if (empty($data['name']))
                $errors[] = 'Obstruction name is required';
            if (!isset($data['lat']))
                $errors[] = 'Latitude is required';
            if (!isset($data['lng']))
                $errors[] = 'Longitude is required';
        }

        if (isset($data['lat'])) {
            $lat = floatval($data['lat']);
            if ($lat < -90 || $lat > 90)
                $errors[] = 'Latitude must be between -90 and 90';
        }
        if (isset($data['lng'])) {
            $lng = floatval($data['lng']);
            if ($lng < -180 || $lng > 180)
                $errors[] = 'Longitude must be between -180 and 180';
        }

        if (isset($data['radiusMeters'])) {
            if (floatval($data['radiusMeters']) <= 0)
                $errors[] = 'Radius must be greater than 0';
        }

        if (isset($data['severity'])) {
            if (!in_array($data['severity'], ['low', 'medium', 'high'])) {
                $errors[] = 'Severity must be low, medium, or high';
            }
        }

        return $errors;
    }

    public static function defaults(array $data): array
    {
        $data['lat'] = floatval($data['lat']);
        $data['lng'] = floatval($data['lng']);
        $data['radiusMeters'] = floatval($data['radiusMeters'] ?? 40);
        $data['severity'] = $data['severity'] ?? 'medium';
        $data['active'] = $data['active'] ?? true;
        return $data;
    }
}
