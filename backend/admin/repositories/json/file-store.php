<?php
// JSON File Store with file locking and version tokens

class FileStore {
    private string $dataDir;

    public function __construct(string $dataDir) {
        $this->dataDir = rtrim($dataDir, '/\\');
        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0777, true);
        }
    }

    private function filePath(string $type): string {
        return $this->dataDir . '/' . $type . '.json';
    }

    public function readAll(string $type): array {
        $path = $this->filePath($type);
        if (!file_exists($path)) {
            file_put_contents($path, json_encode([]));
            return [];
        }
        $data = json_decode(file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    public function findById(string $type, int $id): ?array {
        $items = $this->readAll($type);
        foreach ($items as $item) {
            if (($item['id'] ?? null) == $id) {
                return $item;
            }
        }
        return null;
    }

    public function create(string $type, array $input): array {
        $path = $this->filePath($type);
        $fp = fopen($path, 'c+');
        if (!$fp) throw new RuntimeException("Cannot open $path");
        flock($fp, LOCK_EX);

        $raw = stream_get_contents($fp);
        $data = $raw ? (json_decode($raw, true) ?: []) : [];

        $maxId = 0;
        foreach ($data as $item) {
            if (isset($item['id']) && $item['id'] > $maxId) $maxId = $item['id'];
        }
        $input['id'] = $maxId + 1;

        $data[] = $input;

        fseek($fp, 0);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        flock($fp, LOCK_UN);
        fclose($fp);

        return $input;
    }

    public function update(string $type, int $id, array $fields): ?array {
        $path = $this->filePath($type);
        $fp = fopen($path, 'c+');
        if (!$fp) throw new RuntimeException("Cannot open $path");
        flock($fp, LOCK_EX);

        $raw = stream_get_contents($fp);
        $data = $raw ? (json_decode($raw, true) ?: []) : [];

        $updated = null;
        foreach ($data as &$item) {
            if (($item['id'] ?? null) == $id) {
                foreach ($fields as $k => $v) {
                    if ($k !== 'id') $item[$k] = $v;
                }
                $updated = $item;
                break;
            }
        }
        unset($item);

        if ($updated) {
            fseek($fp, 0);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        }

        flock($fp, LOCK_UN);
        fclose($fp);

        return $updated;
    }

    public function delete(string $type, int $id): bool {
        $path = $this->filePath($type);
        $fp = fopen($path, 'c+');
        if (!$fp) throw new RuntimeException("Cannot open $path");
        flock($fp, LOCK_EX);

        $raw = stream_get_contents($fp);
        $data = $raw ? (json_decode($raw, true) ?: []) : [];

        $before = count($data);
        $data = array_values(array_filter($data, fn($item) => ($item['id'] ?? null) != $id));
        $removed = count($data) < $before;

        if ($removed) {
            fseek($fp, 0);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        }

        flock($fp, LOCK_UN);
        fclose($fp);

        return $removed;
    }
}
