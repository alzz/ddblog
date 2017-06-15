<?php

/**
 * @file
 * Contains \Drupal\ddblog\Controller\DdblogController.
 */

namespace Drupal\ddblog\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Component\Utility\Xss;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Class DdblogController.
 *
 * @package Drupal\ddblog\Controller
 */
class DdblogController extends ControllerBase {

  /**
   * Callback for '/admin/reports/ddblog'.
   *
   * @return array
   */
  public function overview() {
    $build = [];

    // @TODO: render array of buttons.
    $build['toolbar'] = [
      '#type' => 'html_tag',
      '#tag' => 'div',
      '#value' => '<a href="#" id="all" class="button active">All</a><a href="#" id="type" class="button">Types</a>',
      '#attributes' => [ 'id' => ['toolbar'] ],
    ];

    $build['chart'] = [
      '#type' => 'container',
      '#attributes' => [
        'id' => ['chart'],
      ],
    ];

    $build['#attached']['library'][] = 'ddblog/d3';
    $build['#attached']['library'][] = 'ddblog/ddblog.tooltip';
    $build['#attached']['library'][] = 'ddblog/ddblog.bubble_chart';

    return $build;
  }

  /**
   * Callback for '/api/ddblog' API method.
   */
  public function api(Request $request) {
    $data = $this->dblog();

    return new JsonResponse($data);
  }

  /**
   * Shows dblog messages.
   *
   * @return array
   */
  private function dblog() {
    // @TODO: Inyectar use Drupal\Core\Database\Connection
    // Como en /core/modules/dblog/src/Controller/DbLogController.php
    $output = [];

    $query = \Drupal::database()->select('watchdog', 'w');
    $query->addExpression('COUNT(wid)', 'count');
    $query = $query
      ->fields('w', ['type', 'severity', 'message', 'variables'])
      ->groupBy('message')
      ->groupBy('variables')
      ->groupBy('severity')
      ->groupBy('type');
    $result = $query->execute();

    foreach ($result as $dblog) {
      if ($message = $this->formatDblogMessage($dblog)) {
        $output[] = [
          'type' => $dblog->type,
          'severity' => $dblog->severity,
          'message' => $message,
          'total' => $dblog->count
        ];
      }
    }

    return $output;
  }

  /**
   * Formats a database log message.
   *
   * @param object $row
   *   The record from the watchdog table. The object properties are: wid, uid,
   *   severity, type, timestamp, message, variables, link, name.
   *
   * @return string|\Drupal\Core\StringTranslation\TranslatableMarkup|false
   *   The formatted log message or FALSE if the message or variables properties
   *   are not set.
   */
  private function formatDblogMessage($row) {
    // Check for required properties.
    if (isset($row->message, $row->variables)) {
      $variables = @unserialize($row->variables);
      // Messages without variables or user specified text.
      if ($variables === NULL) {
        $message = Xss::filterAdmin($row->message);
      }
      elseif (!is_array($variables)) {
        $message = $this->t('Log data is corrupted and cannot be unserialized: @message', ['@message' => Xss::filterAdmin($row->message)]);
      }
      // Message to translate with injected variables.
      else {
        $message = $this->t(Xss::filterAdmin($row->message), $variables);
      }
    }
    else {
      $message = FALSE;
    }

    return $message;
  }

}
