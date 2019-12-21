<?php

$xml = simplexml_load_file('dinesafe.xml');

$limit = 5000;
$count = 0;

foreach($xml->ROW as $row) {

  $count++;

  $obj = [
    'id' => (int)(string)$row->ROW_ID,
    'establishment' => [
      'id' => (string)$row->ESTABLISHMENT_ID,
      'name' => (string)$row->ESTABLISHMENT_NAME,
      'type' => (string)$row->ESTABLISHMENT_TYPE,
      'address' => (string)$row->ESTABLISHMENT_ADDRESS,
      'geo' => [floatval((string)$row->LATITUDE), floatval((string)$row->LONGITUDE)],
      'status' => (string)$row->ESTABLISHMENT_STATUS,
    ],
    'minimumInspectionsPerYear' => (int)(string)$row->MINIMUM_INSPECTIONS_PERYEAR,
    'infractionDetails' => (string)$row->INFRACTION_DETAILS,
    'inspectionDate' => (string)$row->INSPECTION_DATE,
    'severity' => (string)$row->SEVERITY,
    'action' => (string)$row->ACTION,
    'courtOutcome' => (string)$row->COURT_OUTCOME,
    'amountFined' => (string)$row->AMOUNT_FINED,
  ];

  file_put_contents(__DIR__ . '/' . $obj['id'] . '.json', json_encode($obj, JSON_PRETTY_PRINT)); 

  if ($count===$limit) break;

}
