<?php
// Route Validator

class RouteValidator
{
    public static function validate(array $data, bool $isUpdate = false): array
    {
        $errors = [];

        if (!$isUpdate) {
            if (empty($data['name']))
                $errors[] = 'Route name is required';
            if (!isset($data['stopIds']) || !is_array($data['stopIds'])) {
                $errors[] = 'stopIds array is required';
            }
        }

        if (isset($data['stopIds']) && is_array($data['stopIds'])) {
            if (count($data['stopIds']) < 2) {
                $errors[] = 'Route must have at least 2 stops';
            }
        }

        if (isset($data['weight'])) {
            $w = intval($data['weight']);
            if ($w < 1 || $w > 10)
                $errors[] = 'Weight must be between 1 and 10';
        }

        if (isset($data['ratingAverage'])) {
            $r = floatval($data['ratingAverage']);
            if ($r < 0 || $r > 5)
                $errors[] = 'Rating average must be between 0 and 5';
        }

        if (isset($data['ratingCount'])) {
            $rc = intval($data['ratingCount']);
            if ($rc < 0)
                $errors[] = 'Rating count cannot be negative';
        }

        if (isset($data['ratingCount']) && intval($data['ratingCount']) === 0) {
            $data['ratingAverage'] = 0;
        }

        return $errors;
    }

    public static function defaults(array $data): array
    {
        $data['color'] = $data['color'] ?? '#1d4ed8';
        $data['style'] = $data['style'] ?? 'solid';
        $data['weight'] = intval($data['weight'] ?? 5);
        $data['snapToRoad'] = $data['snapToRoad'] ?? true;
        $data['ratingAverage'] = floatval($data['ratingAverage'] ?? 0);
        $data['ratingCount'] = intval($data['ratingCount'] ?? 0);
        if ($data['ratingCount'] === 0)
            $data['ratingAverage'] = 0;
        return $data;
    }
}
