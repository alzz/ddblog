/**
 * @file
 * dd3blog bubble chart.
 */

(function ($, Drupal) {
  'use strict';

  Drupal.behaviors.ddblog_bubble_chart = {
    attach: function (context, settings) {
      $('#chart', context).once('ddblog-bubble-chart').each(function() {
        console.log('IN!');
      });
  }};

})(jQuery, Drupal);
