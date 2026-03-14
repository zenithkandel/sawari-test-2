<?php
// ============================================================
// Sawari - Vehicle Validator
// Author: Zenith Kandel — https://zenithkandel.com.np
// ============================================================

class VehicleValidator
{
    public static function validate(array $data, bool $isUpdate = false): array
    {
        $errors = [];

        if (!$isUpdate) {
            if (empty($data['name']))
                $errors[] = 'Vehicle name is required';
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

        if (isset($data['speed'])) {
            if (floatval($data['speed']) < 0)
                $errors[] = 'Speed cannot be negative';
        }

        if (isset($data['bearing'])) {
            $b = intval($data['bearing']);
            if ($b < 0 || $b > 359)
                $errors[] = 'Bearing must be between 0 and 359';
        }

        if (isset($data['ratingAverage'])) {
            $r = floatval($data['ratingAverage']);
            if ($r < 0 || $r > 5)
                $errors[] = 'Rating average must be between 0 and 5';
        }

        if (isset($data['ratingCount'])) {
            if (intval($data['ratingCount']) < 0)
                $errors[] = 'Rating count cannot be negative';
        }

        return $errors;
    }

    public static function defaults(array $data): array
    {
        $data['lat'] = floatval($data['lat']);
        $data['lng'] = floatval($data['lng']);
        $data['speed'] = floatval($data['speed'] ?? 0);
        $data['moving'] = $data['moving'] ?? false;
        $data['bearing'] = intval($data['bearing'] ?? 0);
        $data['routeId'] = $data['routeId'] ?? null;
        $data['ratingAverage'] = floatval($data['ratingAverage'] ?? 0);
        $data['ratingCount'] = intval($data['ratingCount'] ?? 0);
        $data['color'] = $data['color'] ?? '#1d4ed8';
        if ($data['ratingCount'] === 0)
            $data['ratingAverage'] = 0;
        return $data;
    }
}
